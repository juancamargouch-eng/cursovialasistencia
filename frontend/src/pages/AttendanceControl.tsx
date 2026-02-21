import axios from 'axios';
import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { RefreshCw, CheckCircle, XCircle, Search, UserPlus, Loader2, FlipHorizontal, ShieldCheck, Building, Camera } from 'lucide-react';
import { getIntegrantes, registrarAsistencia, actualizarFaceDescriptor, getAsociaciones, crearIntegrante, subirFotoIndividual, getAuthenticatedFotoUrl, API_URL } from '../services/api';
import type { Integrante, Asociacion } from '../types';

const AttendanceControl = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const quickVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
    const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
    const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [manualDni, setManualDni] = useState('');
    const [foundIntegrante, setFoundIntegrante] = useState<Integrante | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [cameraError, setCameraError] = useState<string | null>(null);

    // States for manual confirmation & Quick Registration
    const [pendingIntegrante, setPendingIntegrante] = useState<Integrante | null>(null);
    const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);
    const [unknownCount, setUnknownCount] = useState(0);
    const [showQuickRegister, setShowQuickRegister] = useState(false);

    // Form state for Quick Register
    const [quickForm, setQuickForm] = useState({ dni: '', nombres: '', apellidos: '', id_asociacion: 0 });
    const [asocQuery, setAsocQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Broadcast Channel para Vista Pública
    const broadcastChannel = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        broadcastChannel.current = new BroadcastChannel('attendance_updates');
        return () => broadcastChannel.current?.close();
    }, []);

    const getTurnoActual = useCallback(() => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'MAÑANA';
        if (hour >= 12 && hour < 18) return 'TARDE';
        return 'NOCHE';
    }, []);

    const sendBroadcast = useCallback((type: 'FACE_RECOGNIZED' | 'SUCCESS' | 'ALREADY_MARKED' | 'RESET', payload?: { dni: string, nombres: string, apellidos: string, asociacion: string }) => {
        if (broadcastChannel.current) {
            broadcastChannel.current.postMessage({ type, payload });
        }
    }, []);

    const handleAttendance = useCallback(async (id_integrante: number) => {
        setIsProcessingAttendance(true);
        try {
            await registrarAsistencia({
                id_integrante,
                turno: getTurnoActual()
            });
            setMessage({ text: 'Asistencia registrada correctamente.', type: 'success' });

            // Notificar éxito visual a vista pública inmediatamente
            sendBroadcast('SUCCESS');

            // Resetear después de un momento
            setTimeout(() => {
                sendBroadcast('RESET');
                setPendingIntegrante(null);
            }, 3000);

            setFoundIntegrante(null);
            setManualDni('');
            return true;
        } catch (error: unknown) {
            console.error('Error registrando asistencia:', error);
            let msg = 'Error al registrar asistencia';
            if (axios.isAxiosError(error) && error.response?.data?.detail) {
                msg = error.response.data.detail;
                // Si el mensaje indica que ya marcó, notificar a la vista pública con sonido grave
                if (msg.includes('YA MARCÓ')) {
                    sendBroadcast('ALREADY_MARKED');
                }
            }
            setMessage({ text: msg, type: 'error' });
            return false;
        } finally {
            setIsProcessingAttendance(false);
        }
    }, [getTurnoActual, sendBroadcast]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (pendingIntegrante && !isProcessingAttendance) {
                if (e.key === 'Enter') {
                    handleAttendance(pendingIntegrante.id);
                } else if (e.key === 'Escape') {
                    setPendingIntegrante(null);
                    sendBroadcast('RESET');
                }
            } else if (showQuickRegister) {
                if (e.key === 'Escape') {
                    setShowQuickRegister(false);
                    setUnknownCount(0);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pendingIntegrante, isProcessingAttendance, showQuickRegister, handleAttendance, sendBroadcast]);

    // ... (fetchIntegrantes, loadModels, startVideo, etc.) ...

    const fetchIntegrantes = useCallback(async () => {
        try {
            const [intRes, asocRes] = await Promise.all([
                getIntegrantes({ limit: 5000 }), // Cargamos a todos para el faceMatcher
                getAsociaciones()
            ]);

            const data: Integrante[] = intRes.data.items || intRes.data;
            setIntegrantes(data);
            setAsociaciones(asocRes.data);

            const labeledDescriptors = data
                .filter(i => i.face_descriptor)
                .map(i => new faceapi.LabeledFaceDescriptors(
                    i.dni,
                    [new Float32Array(i.face_descriptor!)]
                ));

            if (labeledDescriptors.length > 0) {
                setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.45));
            }
            setConnectionError(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setConnectionError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadModels = async () => {
        const MODEL_URL = '/models';
        try {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            setModelsLoaded(true);
        } catch (error) {
            console.error('Error loading face-api models:', error);
        }
    };

    useEffect(() => {
        loadModels();
        fetchIntegrantes();
    }, [fetchIntegrantes]);

    const startVideo = useCallback(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('El acceso a la cámara no está habilitado.');
            return;
        }

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode }
        })
            .then(stream => {
                if (videoRef.current) videoRef.current.srcObject = stream;
                if (quickVideoRef.current) quickVideoRef.current.srcObject = stream;
                setCameraError(null);
            })
            .catch(err => {
                console.error('Error accessing webcam:', err);
                setCameraError('No se pudo acceder a la cámara.');
            });
    }, [facingMode]);

    const stopVideo = useCallback(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        if (quickVideoRef.current) quickVideoRef.current.srcObject = null;
    }, []);

    const toggleCamera = () => {
        stopVideo();
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    useEffect(() => {
        if (modelsLoaded && !loading) {
            startVideo();
        }
        return () => stopVideo();
    }, [modelsLoaded, loading, startVideo, stopVideo, showQuickRegister]); // Sync stream when modal opens

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (modelsLoaded && videoRef.current && canvasRef.current && faceMatcher && !pendingIntegrante && !showQuickRegister) {
            interval = setInterval(async () => {
                if (videoRef.current && canvasRef.current && !pendingIntegrante && !showQuickRegister) {
                    const detections = await faceapi.detectAllFaces(videoRef.current)
                        .withFaceLandmarks()
                        .withFaceDescriptors();

                    const currentCanvas = canvasRef.current;
                    const currentVideo = videoRef.current;

                    if (currentCanvas && currentVideo) {
                        const dims = faceapi.matchDimensions(currentCanvas, currentVideo, true);
                        const resizedDetections = faceapi.resizeResults(detections, dims);

                        if (resizedDetections.length === 0) return;

                        resizedDetections.forEach(detection => {
                            const result = faceMatcher.findBestMatch(detection.descriptor);
                            const box = detection.detection.box;

                            if (result.label !== 'unknown') {
                                const inte = integrantes.find(i => i.dni === result.label);
                                if (inte && !pendingIntegrante) {
                                    setPendingIntegrante(inte);

                                    // Notificar a vista pública
                                    sendBroadcast('FACE_RECOGNIZED', {
                                        dni: inte.dni,
                                        nombres: inte.nombres,
                                        apellidos: inte.apellidos,
                                        asociacion: asociaciones.find(a => a.id === inte.id_asociacion)?.nombre || 'Independiente'
                                    });

                                    setUnknownCount(0); // Reset count on success
                                    setMessage(null);
                                }
                            } else {
                                // Face detected but not recognized
                                setUnknownCount(prev => prev + 1);
                            }

                            const drawBox = new faceapi.draw.DrawBox(box, {
                                label: result.label === 'unknown' ? 'Desconocido' : result.toString(),
                                boxColor: result.label === 'unknown' ? '#ef4444' : '#10b981'
                            });
                            drawBox.draw(currentCanvas);
                        });
                    }
                }
            }, 700);
        }
        return () => clearInterval(interval);
    }, [modelsLoaded, faceMatcher, integrantes, asociaciones, pendingIntegrante, showQuickRegister, sendBroadcast]);

    const handleQuickRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickForm.dni) return;

        setIsCreating(true);
        try {
            const targetVideo = quickVideoRef.current || videoRef.current;
            if (!targetVideo) throw new Error("No hay cámara disponible");

            // 1. Detectar rostro y obtener descriptor
            const detection = await faceapi.detectSingleFace(targetVideo)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                alert("No se detecta un rostro claro. Por favor, mire fijamente a la cámara.");
                setIsCreating(false);
                return;
            }

            const descriptor = Array.from(detection.descriptor);

            // 2. Obtener Blob de la imagen con recorte 3:4 (Vertical)
            const canvas = document.createElement('canvas');
            const vWidth = targetVideo.videoWidth;
            const vHeight = targetVideo.videoHeight;

            // Calculamos dimensiones para 3:4 (estilo carné)
            // Si el video es más ancho que 3:4, recortamos los lados
            const desiredAspect = 3 / 4;
            let cropWidth = vWidth;
            let cropHeight = vHeight;
            let startX = 0;
            let startY = 0;

            if (vWidth / vHeight > desiredAspect) {
                // Video es demasiado ancho (típico 16:9 o 4:3 horizontal)
                cropWidth = vHeight * desiredAspect;
                startX = (vWidth - cropWidth) / 2;
            } else {
                // Video es demasiado alto
                cropHeight = vWidth / desiredAspect;
                startY = (vHeight - cropHeight) / 2;
            }

            canvas.width = 480; // Resolución estándar para perfil
            canvas.height = 640;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            let photoBlob: Blob | null = null;
            if (ctx) {
                ctx.drawImage(
                    targetVideo,
                    startX, startY, cropWidth, cropHeight, // Corte origen
                    0, 0, canvas.width, canvas.height     // Destino
                );
                photoBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            }

            // 3. Crear integrante con valores por defecto si no se llenaron
            // Si id_asociacion es 0, el backend buscará emparejar con un registro existente.

            await crearIntegrante({
                dni: quickForm.dni,
                nombres: quickForm.nombres || 'POR COMPLETAR',
                apellidos: quickForm.apellidos || 'POR COMPLETAR',
                id_asociacion: quickForm.id_asociacion, // Enviamos 0 si no se seleccionó nada
                tiene_foto: true,
                face_descriptor: descriptor
            });

            // 4. Subir foto física (.jpg por DNI)
            if (photoBlob) {
                await subirFotoIndividual(quickForm.dni, photoBlob);
            }

            setMessage({ text: 'Registro completado exitosamente.', type: 'success' });
            setShowQuickRegister(false);
            setUnknownCount(0);
            fetchIntegrantes();

            // Limpiar formulario
            setQuickForm({ dni: '', nombres: '', apellidos: '', id_asociacion: 0 });
            setAsocQuery('');
        } catch (error: unknown) {
            console.error('Error en registro rápido:', error);
            let msg = 'Error al registrar integrante';
            if (axios.isAxiosError(error) && error.response?.data?.detail) {
                msg = error.response.data.detail;
            }
            setMessage({ text: msg, type: 'error' });
        } finally {
            setIsCreating(false);
        }
    };

    // Filtered associations for search
    const filteredAsociaciones = asocQuery.length >= 3
        ? asociaciones.filter(a => a.nombre.toLowerCase().includes(asocQuery.toLowerCase())).slice(0, 5)
        : [];

    return (
        <div className="space-y-6">
            {connectionError && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 text-rose-700">
                        <XCircle size={24} />
                        <div>
                            <p className="font-bold text-sm">Error de Conexión</p>
                            <p className="text-xs opacity-80">Debe autorizar el certificado de la API.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main: Camera */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                        <div className="relative aspect-[3/4] lg:max-w-md lg:mx-auto bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                            {!modelsLoaded && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-4">
                                    <Loader2 className="animate-spin text-primary-400" size={48} />
                                    <p className="font-medium">Iniciando IA Facial...</p>
                                </div>
                            )}
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

                            {cameraError && (
                                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 z-50">
                                    <XCircle size={40} className="text-rose-500" />
                                    <p className="text-xs opacity-80">{cameraError}</p>
                                    <div className="bg-slate-800 p-3 rounded-xl text-left text-[10px] font-mono border border-slate-700 space-y-1">
                                        <p className="text-primary-400 font-bold underline">SOLUCIÓN:</p>
                                        <p>1. Visite: <a href={`${API_URL}/asociaciones/`} target="_blank" rel="noreferrer" className="text-blue-400 underline font-bold">Verificar API</a></p>
                                        <p>2. Clic en "Configuración Avanzada" y luego en "Acceder/Proceder".</p>
                                        <p>3. Regrese y recargue esta pantalla.</p>
                                    </div>
                                </div>
                            )}

                            {message && !pendingIntegrante && !showQuickRegister && (
                                <div className={`absolute bottom-4 left-4 right-4 p-3 rounded-xl flex items-center space-x-2 animate-in slide-in-from-bottom-2 z-30 shadow-lg ${message.type === 'success' ? 'bg-emerald-500 text-white' :
                                    message.type === 'error' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                                    }`}>
                                    {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                    <span className="font-bold text-sm">{message.text}</span>
                                </div>
                            )}

                            {/* UNKNOWN COUNTER NOTIFICATION */}
                            {unknownCount >= 3 && !pendingIntegrante && !showQuickRegister && (
                                <div className="absolute top-4 left-4 right-4 bg-amber-500 text-white p-3 rounded-xl flex items-center justify-between shadow-xl animate-bounce z-50">
                                    <div className="flex items-center space-x-2">
                                        <Search size={20} />
                                        <span className="font-bold text-sm">Persona no reconocida</span>
                                    </div>
                                    <button
                                        onClick={() => setShowQuickRegister(true)}
                                        className="bg-white text-amber-600 px-4 py-1 rounded-lg text-xs font-black uppercase hover:bg-amber-50 transition-colors"
                                    >
                                        Registrar Ahora
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex flex-wrap justify-between items-center gap-4 px-2">
                            <div className="flex items-center space-x-2 text-slate-500">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold uppercase tracking-tighter">Cámara en red local - {getTurnoActual()}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => window.open('/public-check-in', '_blank', 'width=1000,height=800')}
                                    className="bg-primary-50 hover:bg-primary-100 text-primary-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 border border-primary-100 transition-colors"
                                    title="Abrir pantalla para el conductor"
                                >
                                    <Camera size={14} />
                                    <span>Vista Pública</span>
                                </button>
                                <button onClick={toggleCamera} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2">
                                    <FlipHorizontal size={14} />
                                    <span>Girar</span>
                                </button>
                                <button onClick={() => { setLoading(true); fetchIntegrantes(); }} className="p-2 text-slate-400 hover:text-primary-600">
                                    <RefreshCw size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Manual Actions */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
                            <Search size={20} className="text-primary-500" />
                            <span>Búsqueda Manual</span>
                        </h4>
                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="DNI del integrante..."
                                    value={manualDni}
                                    onChange={(e) => setManualDni(e.target.value)}
                                    className="w-full pl-4 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                                <button onClick={() => {
                                    const searchLower = manualDni.trim().toLowerCase();
                                    const inte = integrantes.find(i =>
                                        i.dni === searchLower ||
                                        i.id.toString() === searchLower
                                    );
                                    if (inte) setFoundIntegrante(inte);
                                    else setMessage({ text: 'No se encontró integrante (DNI o ID)', type: 'error' });
                                }} className="absolute right-2 top-1.5 p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg">
                                    <Search size={20} />
                                </button>
                            </div>

                            {foundIntegrante && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200">
                                            <img
                                                src={getAuthenticatedFotoUrl(foundIntegrante.dni)}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(foundIntegrante.nombres); }}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <h5 className="font-bold text-slate-800 text-sm">
                                                {foundIntegrante.apellidos}, {foundIntegrante.nombres}
                                            </h5>
                                            <p className="text-xs text-slate-500">DNI: {foundIntegrante.dni}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <button onClick={() => handleAttendance(foundIntegrante.id)} className="w-full py-2 bg-primary-600 text-white rounded-lg font-bold text-sm">
                                            Solo Asistencia
                                        </button>
                                        <button onClick={async () => {
                                            setIsCapturing(true);
                                            const detection = await faceapi.detectSingleFace(videoRef.current!).withFaceLandmarks().withFaceDescriptor();
                                            if (detection) {
                                                await actualizarFaceDescriptor(foundIntegrante.id, Array.from(detection.descriptor));
                                                await handleAttendance(foundIntegrante.id);
                                                fetchIntegrantes();
                                            } else {
                                                setMessage({ text: 'No se detecta rostro', type: 'error' });
                                            }
                                            setIsCapturing(false);
                                        }} disabled={isCapturing} className="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm flex items-center justify-center space-x-2">
                                            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <><UserPlus size={16} /><span>Enrolar y Marcar</span></>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-primary-600 rounded-2xl p-6 text-white text-center">
                        <h5 className="font-black text-xs uppercase tracking-widest opacity-80">Turno Atendido</h5>
                        <p className="text-3xl font-black mt-1 leading-none">{getTurnoActual()}</p>
                    </div>
                </div>
            </div>

            {/* CONFIRMATION MODAL */}
            {pendingIntegrante && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 z-[9999]">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95">
                        <div className="p-6 bg-primary-600 text-white flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <ShieldCheck size={28} />
                                <h5 className="font-black text-xl">¿Es este el integrante?</h5>
                            </div>
                        </div>
                        <div className="p-10 space-y-8 text-center">
                            <div className="relative inline-block mx-auto">
                                <div className="w-48 h-48 rounded-[2.5rem] border-8 border-slate-50 overflow-hidden shadow-2xl transform rotate-2">
                                    <img
                                        src={getAuthenticatedFotoUrl(pendingIntegrante.dni)}
                                        className="w-full h-full object-cover -rotate-2 scale-110"
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(`${pendingIntegrante.nombres} ${pendingIntegrante.apellidos}`) + '&background=random'; }}
                                    />
                                </div>
                                <div className="absolute -bottom-4 -right-4 bg-emerald-500 text-white p-4 rounded-3xl border-4 border-white shadow-xl">
                                    <CheckCircle size={32} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-2xl font-black text-slate-800 uppercase leading-tight line-clamp-2">
                                    {pendingIntegrante.apellidos}, {pendingIntegrante.nombres}
                                </h4>
                                <div className="inline-flex items-center px-4 py-1.5 bg-slate-100 rounded-2xl">
                                    <span className="text-sm font-mono text-slate-500 font-bold tracking-widest">DNI: {pendingIntegrante.dni}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setPendingIntegrante(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 hover:text-slate-600 transition-all">
                                    ESC - Cancelar
                                </button>
                                <button onClick={() => handleAttendance(pendingIntegrante.id)} disabled={isProcessingAttendance} className="py-4 bg-primary-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-700 shadow-xl shadow-primary-200 flex items-center justify-center space-x-2">
                                    {isProcessingAttendance ? <Loader2 className="animate-spin" size={20} /> : <><span>Enter - Confirmar</span></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK REGISTER MODAL */}
            {showQuickRegister && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 flex flex-col max-h-[95vh]">
                        {/* Header - Fixed */}
                        <div className="p-6 bg-amber-600 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center space-x-3">
                                <UserPlus size={28} />
                                <h5 className="font-black text-xl">Registro de Nuevo Alumno</h5>
                            </div>
                            <button onClick={() => { setShowQuickRegister(false); setUnknownCount(0); }} className="p-2 hover:bg-white/20 rounded-xl">
                                <XCircle size={28} />
                            </button>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto">
                            <form onSubmit={handleQuickRegister} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento (DNI) *OBLIGATORIO</label>
                                        <div className="relative">
                                            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                                            <input
                                                required
                                                type="text"
                                                placeholder="Ingrese DNI..."
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none font-bold text-xl transition-all"
                                                value={quickForm.dni}
                                                onChange={e => setQuickForm({ ...quickForm, dni: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombres (Opcional)</label>
                                            <input
                                                type="text"
                                                placeholder="PENDIENTE"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400"
                                                value={quickForm.nombres}
                                                onChange={e => setQuickForm({ ...quickForm, nombres: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellidos (Opcional)</label>
                                            <input
                                                type="text"
                                                placeholder="PENDIENTE"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400"
                                                value={quickForm.apellidos}
                                                onChange={e => setQuickForm({ ...quickForm, apellidos: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa / Asociación (Opcional)</label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-3 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Buscar empresa..."
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-400"
                                                value={asocQuery}
                                                onChange={e => setAsocQuery(e.target.value)}
                                            />
                                            {filteredAsociaciones.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100]">
                                                    {filteredAsociaciones.map(a => (
                                                        <button
                                                            key={a.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setQuickForm({ ...quickForm, id_asociacion: a.id });
                                                                setAsocQuery(a.nombre);
                                                            }}
                                                            className="w-full p-4 text-left hover:bg-amber-50 font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                                                        >
                                                            {a.nombre}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Video Preview - Moved Down */}
                                <div className="p-0 bg-slate-900 aspect-[3/4] relative overflow-hidden ring-4 ring-amber-500/20 border-2 border-amber-600 rounded-2xl shrink-0">
                                    <video
                                        ref={quickVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="w-full h-full object-cover rounded-xl"
                                    />

                                    {cameraError && (
                                        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-4 text-center text-white space-y-3 z-50 rounded-xl">
                                            <XCircle size={32} className="text-rose-500" />
                                            <p className="text-[10px] opacity-80">{cameraError}</p>
                                            <div className="bg-slate-800 p-2 rounded-lg text-left text-[9px] font-mono border border-slate-700 space-y-1 w-full">
                                                <p className="text-primary-400 font-bold underline uppercase">Solución:</p>
                                                <p>1. Autorice HTTPS en: <a href={`${API_URL}/`} target="_blank" rel="noreferrer" className="text-blue-400 underline font-bold">Ver API</a></p>
                                                <p>2. Clic en "Avanzado" e "Ir a sitio".</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 border-[15px] border-amber-600/10 pointer-events-none flex items-center justify-center">
                                        <div className="w-40 h-56 border-2 border-dashed border-white/40 rounded-[2.5rem]"></div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={toggleCamera}
                                        className="absolute top-2 right-2 bg-white/20 backdrop-blur-md text-white p-2 rounded-xl hover:bg-white/40 transition-all border border-white/30 text-white"
                                        title="Girar Cámara"
                                    >
                                        <FlipHorizontal size={20} />
                                    </button>

                                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                                        <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-xl animate-pulse">
                                            Vista Previa
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isCreating}
                                        className={`w-full py-5 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl transition-all flex items-center justify-center space-x-3 active:scale-95 ${isCreating ? 'bg-slate-200 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-200'}`}
                                    >
                                        {isCreating ? <Loader2 className="animate-spin" /> : (
                                            <>
                                                <Camera size={24} />
                                                <span>Capturar y Registrar</span>
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[10px] text-slate-400 text-center mt-4 font-bold uppercase tracking-tighter">
                                        Asegúrese que la persona esté mirando a la cámara antes de presionar el botón.
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceControl;
