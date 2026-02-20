import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue, memo } from 'react';
import { UserPlus, Loader2, User, Camera, RefreshCw, CheckCircle, XCircle, Edit, Trash2, FlipHorizontal, Download } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { getIntegrantes, crearIntegrante, getAsociaciones, actualizarIntegrante, eliminarIntegrante, subirFotoIndividual, API_URL } from '../services/api';
import type { Integrante, Asociacion } from '../types';

const IntegranteRow = memo(({ inte, asociacionName, onEdit, onDelete }: {
    inte: Integrante,
    asociacionName: string,
    onEdit: (inte: Integrante) => void,
    onDelete: (id: number) => void
}) => {
    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-6 py-4 font-mono text-slate-600">{inte.dni}</td>
            <td className="px-6 py-4 font-medium text-slate-800">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {inte.tiene_foto ? (
                            <img
                                src={`${API_URL}/fotos/${inte.dni}.jpg`}
                                alt={inte.nombres}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(`${inte.nombres} ${inte.apellidos}`) + '&background=random';
                                }}
                            />
                        ) : <User size={20} className="text-slate-400" />}
                    </div>
                    <div className="flex flex-col">
                        <span className="leading-none">{inte.apellidos}, {inte.nombres}</span>
                        <span className="text-[10px] text-slate-400 font-mono mt-1">ID: {inte.id}</span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-slate-500">
                {asociacionName}
            </td>
            <td className="px-6 py-4">
                {inte.tiene_foto ? (
                    <span className="flex items-center space-x-1 text-emerald-600 font-medium text-sm">
                        <CheckCircle size={16} />
                        <span>Capturada</span>
                    </span>
                ) : (
                    <span className="flex items-center space-x-1 text-slate-400 font-medium text-sm">
                        <XCircle size={16} />
                        <span>Sin Foto</span>
                    </span>
                )}
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center space-x-1">
                    <button
                        onClick={() => onEdit(inte)}
                        className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                        title="Editar datos"
                    >
                        <Edit size={18} />
                    </button>
                    {inte.tiene_foto && (
                        <a
                            href={`${API_URL}/fotos/${inte.dni}.jpg`}
                            download={`${inte.dni}.jpg`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                            title="Descargar Foto"
                        >
                            <Download size={18} />
                        </a>
                    )}
                    <button
                        onClick={() => onDelete(inte.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Eliminar integrante"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </td>
        </tr>
    );
});

const IntegrantesPage = () => {
    const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
    const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingIntegrante, setEditingIntegrante] = useState<Integrante | null>(null);

    // Filter & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAsociacion, setFilterAsociacion] = useState<string>('all');

    // Defer filtering to keep input responsive
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const deferredFilterAsociacion = useDeferredValue(filterAsociacion);

    // Camera & IA State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
    const [faceDetected, setFaceDetected] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        dni: '',
        nombres: '',
        apellidos: '',
        id_asociacion: '',
        tiene_foto: false,
        face_descriptor: null as number[] | null
    });

    useEffect(() => {
        fetchData();
        loadModels();
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

    const fetchData = async () => {
        try {
            const [intRes, asocRes] = await Promise.all([
                getIntegrantes(),
                getAsociaciones()
            ]);
            setIntegrantes(intRes.data);
            setAsociaciones(asocRes.data);
            setConnectionError(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setConnectionError(true);
        } finally {
            setLoading(false);
        }
    };

    const startCamera = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Cámara bloqueada por seguridad. Use HTTPS o ajuste los permisos del navegador.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facingMode }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraActive(true);
                setCameraError(null);
            }
        } catch (err: unknown) {
            console.error('Error accessing webcam:', err);
            setCameraError('No se pudo acceder a la cámara. Verifique permisos o conexión segura (SSL).');
        }
    }, [facingMode]);

    const stopCamera = useCallback(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsCameraActive(false);
        }
    }, []);

    const toggleCamera = () => {
        stopCamera();
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    useEffect(() => {
        if (isModalOpen && modelsLoaded) {
            startCamera();
        } else {
            stopCamera();
            setCapturedDescriptor(null);
            setFaceDetected(false);
        }
    }, [isModalOpen, modelsLoaded, startCamera, stopCamera]);

    // Loop de detección en tiempo real para feedback visual
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isCameraActive && videoRef.current && canvasRef.current) {
            interval = setInterval(async () => {
                if (videoRef.current && canvasRef.current) {
                    const detection = await faceapi.detectSingleFace(videoRef.current)
                        .withFaceLandmarks();

                    if (detection) {
                        setFaceDetected(true);
                        const currentCanvas = canvasRef.current;
                        const currentVideo = videoRef.current;
                        if (currentCanvas && currentVideo) {
                            const dims = faceapi.matchDimensions(currentCanvas, currentVideo, true);
                            const resizedDetections = faceapi.resizeResults(detection, dims);

                            // Dibujar cuadro verde suave
                            const drawBox = new faceapi.draw.DrawBox(resizedDetections.detection.box, {
                                label: 'Rostro Detectado',
                                boxColor: '#10b981'
                            });
                            drawBox.draw(currentCanvas);
                        }
                    } else {
                        setFaceDetected(false);
                        const currentCanvas = canvasRef.current;
                        if (currentCanvas) {
                            const ctx = currentCanvas.getContext('2d', { willReadFrequently: true });
                            ctx?.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
                        }
                    }
                }
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isCameraActive]);

    const capturePhoto = async () => {
        if (!videoRef.current) return;
        try {
            const detection = await faceapi.detectSingleFace(videoRef.current)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                setCapturedDescriptor(Array.from(detection.descriptor));
            } else {
                alert('No se detectó un rostro claro. Intente de nuevo.');
            }
        } catch (error) {
            console.error('Error capturing face:', error);
        }
    };

    const openCreateModal = () => {
        setEditMode(false);
        setEditingIntegrante(null);
        setFormData({ dni: '', nombres: '', apellidos: '', id_asociacion: '', tiene_foto: false, face_descriptor: null });
        setCapturedDescriptor(null);
        setIsModalOpen(true);
    };

    const openEditModal = useCallback((inte: Integrante) => {
        setEditMode(true);
        setEditingIntegrante(inte);
        setFormData({
            dni: inte.dni,
            nombres: inte.nombres,
            apellidos: inte.apellidos,
            id_asociacion: inte.id_asociacion.toString(),
            tiene_foto: inte.tiene_foto,
            face_descriptor: inte.face_descriptor || null
        });
        setCapturedDescriptor(null);
        setIsModalOpen(true);
    }, []);

    const handleDelete = useCallback(async (id: number) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este integrante? Esta acción es permanente.')) return;

        try {
            await eliminarIntegrante(id);
            fetchData();
        } catch (error: unknown) {
            console.error('Error deleting integrante:', error);
            alert('Error al eliminar el integrante.');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.dni || !formData.nombres || !formData.apellidos || !formData.id_asociacion) return;

        setSaving(true);
        try {
            if (editingIntegrante) {
                // 1. Actualizar datos base
                await actualizarIntegrante(editingIntegrante.id, {
                    nombres: formData.nombres,
                    apellidos: formData.apellidos,
                    id_asociacion: parseInt(formData.id_asociacion),
                    // Solo enviamos descriptor si se capturó uno nuevo
                    face_descriptor: capturedDescriptor || undefined,
                    tiene_foto: capturedDescriptor ? true : formData.tiene_foto
                });

                // 2. Subir nueva foto física con recorte 3:4 (Vertical)
                if (videoRef.current && capturedDescriptor) {
                    const canvas = document.createElement('canvas');
                    const vWidth = videoRef.current.videoWidth;
                    const vHeight = videoRef.current.videoHeight;

                    const desiredAspect = 3 / 4;
                    let cropWidth = vWidth;
                    let cropHeight = vHeight;
                    let startX = 0;
                    let startY = 0;

                    if (vWidth / vHeight > desiredAspect) {
                        cropWidth = vHeight * desiredAspect;
                        startX = (vWidth - cropWidth) / 2;
                    } else {
                        cropHeight = vWidth / desiredAspect;
                        startY = (vHeight - cropHeight) / 2;
                    }

                    canvas.width = 480;
                    canvas.height = 640;

                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        ctx.drawImage(
                            videoRef.current,
                            startX, startY, cropWidth, cropHeight,
                            0, 0, canvas.width, canvas.height
                        );
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                        if (blob) {
                            await subirFotoIndividual(formData.dni, blob);
                        }
                    }
                }
            } else {
                // 1. Crear integrante
                await crearIntegrante({
                    dni: formData.dni,
                    nombres: formData.nombres,
                    apellidos: formData.apellidos,
                    id_asociacion: parseInt(formData.id_asociacion),
                    tiene_foto: !!capturedDescriptor,
                    face_descriptor: capturedDescriptor || undefined
                });

                // 2. Subir foto física con recorte 3:4
                if (videoRef.current && capturedDescriptor) {
                    const canvas = document.createElement('canvas');
                    const vWidth = videoRef.current.videoWidth;
                    const vHeight = videoRef.current.videoHeight;

                    const desiredAspect = 3 / 4;
                    let cropWidth = vWidth;
                    let cropHeight = vHeight;
                    let startX = 0;
                    let startY = 0;

                    if (vWidth / vHeight > desiredAspect) {
                        cropWidth = vHeight * desiredAspect;
                        startX = (vWidth - cropWidth) / 2;
                    } else {
                        cropHeight = vWidth / desiredAspect;
                        startY = (vHeight - cropHeight) / 2;
                    }

                    canvas.width = 480;
                    canvas.height = 640;

                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        ctx.drawImage(
                            videoRef.current,
                            startX, startY, cropWidth, cropHeight,
                            0, 0, canvas.width, canvas.height
                        );
                        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
                        if (blob) {
                            await subirFotoIndividual(formData.dni, blob);
                        }
                    }
                }
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error: unknown) {
            console.error('Error saving integrante:', error);
            alert('Error al guardar el integrante.');
        } finally {
            setSaving(false);
        }
    };

    const filteredIntegrantes = useMemo(() => {
        return integrantes.filter(inte => {
            const matchesSearch =
                inte.nombres.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
                inte.apellidos.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
                inte.dni.includes(deferredSearchTerm);

            const matchesFilter = deferredFilterAsociacion === 'all' || inte.id_asociacion === parseInt(deferredFilterAsociacion);

            return matchesSearch && matchesFilter;
        });
    }, [integrantes, deferredSearchTerm, deferredFilterAsociacion]);

    return (
        <div className="space-y-6">
            {connectionError && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center space-x-3 text-rose-700">
                        <XCircle size={24} />
                        <div>
                            <p className="font-bold text-sm">Error de Conexión</p>
                            <p className="text-xs opacity-80">Debe autorizar el certificado de la API (puerto 8000).</p>
                        </div>
                    </div>
                    <a
                        href={`${API_URL}/asociaciones/`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-rose-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-md active:scale-95"
                    >
                        Autorizar API
                    </a>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Integrantes</h3>
                    <p className="text-slate-500">Gestión de conductores y asociados</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                >
                    <UserPlus size={20} />
                    <span>Nuevo Integrante</span>
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    />
                    <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                </div>
                <div className="md:w-64">
                    <select
                        value={filterAsociacion}
                        onChange={(e) => setFilterAsociacion(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white outline-none transition-all"
                    >
                        <option value="all">Todas las Empresas</option>
                        {asociaciones.map(asoc => (
                            <option key={asoc.id} value={asoc.id}>{asoc.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="animate-spin text-primary-500" size={32} />
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-4">DNI</th>
                                    <th className="px-6 py-4">Integrantes (Apellidos y Nombres)</th>
                                    <th className="px-6 py-4">Asociación</th>
                                    <th className="px-6 py-4">Estado Foto</th>
                                    <th className="px-6 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredIntegrantes.map((inte) => (
                                    <IntegranteRow
                                        key={inte.id}
                                        inte={inte}
                                        asociacionName={asociaciones.find(a => a.id === inte.id_asociacion)?.nombre || 'N/A'}
                                        onEdit={openEditModal}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col lg:flex-row overflow-hidden max-h-[90vh]">
                        <div className={`lg:w-1/2 bg-slate-100 p-6 flex flex-col justify-center items-center relative border-b lg:border-b-0 lg:border-r border-slate-200`}>
                            <h4 className="text-lg font-bold text-slate-700 mb-4 flex items-center space-x-2 w-full">
                                <Camera size={20} className="text-primary-500" />
                                <span>Captura de Rostro</span>
                            </h4>

                            <div className="relative aspect-[3/4] lg:max-w-sm w-full bg-slate-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                                {!modelsLoaded && (
                                    <div className="text-white text-center">
                                        <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                                        <p className="text-sm">Iniciando IA...</p>
                                    </div>
                                )}
                                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

                                <div className="absolute inset-0 border-[20px] border-emerald-500/10 pointer-events-none flex items-center justify-center">
                                    <div className="w-48 h-64 border-2 border-dashed border-white/40 rounded-[3rem]"></div>
                                </div>

                                {cameraError && (
                                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 z-20">
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

                                {capturedDescriptor && (
                                    <div className="absolute inset-0 bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center">
                                        <div className="bg-emerald-500 text-white px-4 py-2 rounded-full font-bold flex items-center space-x-2">
                                            <CheckCircle size={20} />
                                            <span>¡Rostro Capturado!</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={toggleCamera}
                                className="w-full py-2 mb-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium flex items-center justify-center space-x-2 text-xs"
                            >
                                <FlipHorizontal size={16} />
                                <span>Girar Cámara</span>
                            </button>
                            {capturedDescriptor ? (
                                <button
                                    type="button"
                                    onClick={() => setCapturedDescriptor(null)}
                                    className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium flex items-center justify-center space-x-2"
                                >
                                    <RefreshCw size={18} />
                                    <span>Volver a Capturar</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={capturePhoto}
                                    disabled={!faceDetected}
                                    className={`w-full py-3 rounded-lg transition-all font-bold flex items-center justify-center space-x-2 shadow-sm ${faceDetected
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    <Camera size={20} />
                                    <span>Capturar Fotografía</span>
                                </button>
                            )}
                        </div>

                        <div className="lg:w-1/2 p-8 overflow-y-auto">
                            <h3 className="text-2xl font-bold text-slate-800 mb-6">
                                {editMode ? 'Editar Datos' : 'Nuevo Integrante'}
                            </h3>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">DNI (Identificación)</label>
                                    <input
                                        type="text"
                                        value={formData.dni}
                                        onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                                        className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none ${editMode ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                                        placeholder="Ingrese el DNI"
                                        required
                                        disabled={editMode}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Apellidos</label>
                                        <input
                                            type="text"
                                            value={formData.apellidos}
                                            onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                            placeholder="Apellidos"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombres</label>
                                        <input
                                            type="text"
                                            value={formData.nombres}
                                            onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                            placeholder="Nombres"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Asociación (EMPRESA)</label>
                                    <select
                                        value={formData.id_asociacion}
                                        onChange={(e) => setFormData({ ...formData, id_asociacion: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none bg-white"
                                        required
                                    >
                                        <option value="">Seleccione una asociación</option>
                                        {asociaciones.map(a => (
                                            <option key={a.id} value={a.id}>{a.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex space-x-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving || (!editMode && !capturedDescriptor)}
                                        className={`flex-2 px-8 py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 font-bold ${saving || (!editMode && !capturedDescriptor)
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            : 'bg-primary-600 text-white hover:bg-primary-700'
                                            }`}
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={18} /> : (
                                            <span>{editMode ? (capturedDescriptor ? 'Actualizar con Nueva Foto' : 'Guardar Cambios') : 'Registrar Integrante'}</span>
                                        )}
                                    </button>
                                </div>
                                {!capturedDescriptor && !saving && !editMode && (
                                    <p className="text-xs text-rose-500 text-center font-medium">Debe capturar el rostro antes de guardar.</p>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrantesPage;
