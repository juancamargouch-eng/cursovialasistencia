import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { UserPlus, Loader2, User, Camera, RefreshCw, CheckCircle, XCircle, Edit, Trash2, FlipHorizontal, Download, ChevronLeft, ChevronRight, Search as SearchIcon, AlertTriangle } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { getIntegrantes, crearIntegrante, getAsociaciones, actualizarIntegrante, eliminarIntegrante, subirFotoIndividual, getAuthenticatedFotoUrl } from '../services/api';
import type { Integrante, Asociacion } from '../types';

const IntegranteRow = memo(({ inte, asociacionName, onEdit, onDelete }: {
    inte: Integrante,
    asociacionName: string,
    onEdit: (inte: Integrante) => void,
    onDelete: (inte: Integrante) => void
}) => {
    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-6 py-4 font-mono text-slate-600">{inte.dni}</td>
            <td className="px-6 py-4 font-medium text-slate-800">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {inte.tiene_foto ? (
                            <img
                                src={getAuthenticatedFotoUrl(inte.dni)}
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
                            href={getAuthenticatedFotoUrl(inte.dni)}
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
                        onClick={() => onDelete(inte)}
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
    const [totalRecords, setTotalRecords] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Integrante | null>(null);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingIntegrante, setEditingIntegrante] = useState<Integrante | null>(null);

    // Paginación y Búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAsociacion, setFilterAsociacion] = useState<string>('all');
    const [page, setPage] = useState(1);
    const limit = 20;

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
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

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
        loadModels();
        fetchAsociaciones();
    }, []);

    const fetchAsociaciones = async () => {
        try {
            const res = await getAsociaciones();
            setAsociaciones(res.data);
        } catch (error) {
            console.error('Error fetching asociaciones:', error);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                skip: (page - 1) * limit,
                limit: limit,
                search: searchTerm || undefined,
                id_asociacion: filterAsociacion === 'all' ? undefined : parseInt(filterAsociacion)
            };
            const res = await getIntegrantes(params);
            setIntegrantes(res.data.items);
            setTotalRecords(res.data.total);
            setConnectionError(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setConnectionError(true);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm, filterAsociacion]);

    // Resetear a página 1 cuando cambia la búsqueda o el filtro
    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterAsociacion]);

    // Cargar datos cuando cambie cualquier parámetro (con un pequeño debounce)
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, searchTerm, filterAsociacion, fetchData]);

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

    const startCamera = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Cámara bloqueada por seguridad.');
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
            setCameraError('No se pudo acceder a la cámara.');
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
            setCapturedImage(null);
            setFaceDetected(false);
        }
    }, [isModalOpen, modelsLoaded, startCamera, stopCamera]);

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
                            currentCanvas.getContext('2d', { willReadFrequently: true });
                            const dims = faceapi.matchDimensions(currentCanvas, currentVideo, true);
                            const resizedDetections = faceapi.resizeResults(detection, dims);
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
                // Capturar el frame actual para la previsualización con recorte 3:4
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
                if (ctx && videoRef.current) {
                    ctx.drawImage(videoRef.current, startX, startY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    setCapturedImage(dataUrl);
                }
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
        setCapturedImage(null);
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
        setCapturedImage(null);
        setIsModalOpen(true);
    }, []);

    const handleDelete = useCallback(async (inte: Integrante) => {
        setDeleteConfirm(inte);
    }, []);

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await eliminarIntegrante(deleteConfirm.id);
            setDeleteConfirm(null);
            fetchData();
        } catch (error: unknown) {
            console.error('Error deleting integrante:', error);
            alert('Error al eliminar el integrante.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.dni || !formData.nombres || !formData.apellidos || !formData.id_asociacion) return;

        setSaving(true);
        try {
            if (editingIntegrante) {
                await actualizarIntegrante(editingIntegrante.id, {
                    dni: formData.dni,
                    nombres: formData.nombres,
                    apellidos: formData.apellidos,
                    id_asociacion: parseInt(formData.id_asociacion),
                    face_descriptor: capturedDescriptor || undefined,
                    tiene_foto: capturedDescriptor ? true : formData.tiene_foto
                });

                if (capturedImage && capturedDescriptor) {
                    const response = await fetch(capturedImage);
                    const blob = await response.blob();
                    if (blob) await subirFotoIndividual(formData.dni, blob);
                }
            } else {
                await crearIntegrante({
                    dni: formData.dni,
                    nombres: formData.nombres,
                    apellidos: formData.apellidos,
                    id_asociacion: parseInt(formData.id_asociacion),
                    tiene_foto: !!capturedDescriptor,
                    face_descriptor: capturedDescriptor || undefined
                });

                if (capturedImage && capturedDescriptor) {
                    const response = await fetch(capturedImage);
                    const blob = await response.blob();
                    if (blob) await subirFotoIndividual(formData.dni, blob);
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

    const totalPages = Math.ceil(totalRecords / limit);

    return (
        <div className="space-y-6">
            {connectionError && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 text-rose-700">
                        <XCircle size={24} />
                        <div>
                            <p className="font-bold text-sm">Error de Conexión</p>
                            <p className="text-xs opacity-80">Verifique la conexión con la API.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Integrantes</h3>
                    <p className="text-slate-500">Gestión de conductores y asociados ({totalRecords} total)</p>
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
                    <SearchIcon className="absolute left-3 top-2.5 text-slate-400" size={18} />
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
                        <>
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
                                    {integrantes.map((inte) => (
                                        <IntegranteRow
                                            key={inte.id}
                                            inte={inte}
                                            asociacionName={asociaciones.find(a => a.id === inte.id_asociacion)?.nombre || 'N/A'}
                                            onEdit={openEditModal}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                    {integrantes.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                                                No se encontraron resultados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Controles de Paginación */}
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-sm text-slate-500">
                                    Mostrando pág. {page} de {totalPages || 1} ({totalRecords} registros)
                                </span>
                                <div className="flex items-center space-x-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(prev => prev - 1)}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(prev => prev + 1)}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden max-h-[95vh] lg:max-h-[90vh]">
                        <div className={`lg:w-1/2 bg-slate-100 p-4 md:p-6 flex flex-col justify-center items-center relative border-b lg:border-b-0 lg:border-r border-slate-200 shrink-0`}>
                            <h4 className="text-lg font-bold text-slate-700 mb-4 flex items-center space-x-2 w-full">
                                <Camera size={20} className="text-primary-500" />
                                <span>Captura de Rostro</span>
                            </h4>

                            <div className="relative aspect-[3/4] max-w-[280px] md:max-w-sm w-full bg-slate-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                                {!modelsLoaded && (
                                    <div className="text-white text-center">
                                        <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                                        <p className="text-sm">Iniciando IA...</p>
                                    </div>
                                )}
                                {capturedImage && (
                                    <img src={capturedImage} className="w-full h-full object-cover absolute inset-0 z-10" alt="Captura" />
                                )}
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className={`w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`}
                                />
                                <canvas ref={canvasRef} className={`absolute top-0 left-0 w-full h-full pointer-events-none z-20 ${capturedImage ? 'hidden' : ''}`} />

                                <div className="absolute inset-0 border-[20px] border-emerald-500/10 pointer-events-none flex items-center justify-center">
                                    <div className="w-48 h-64 border-2 border-dashed border-white/40 rounded-[3rem]"></div>
                                </div>

                                {cameraError && (
                                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 z-20">
                                        <XCircle size={40} className="text-rose-500" />
                                        <p className="text-xs opacity-80">{cameraError}</p>
                                    </div>
                                )}

                                {capturedDescriptor && (
                                    <div className="absolute inset-x-0 bottom-0 top-auto h-auto bg-gradient-to-t from-emerald-600/90 via-emerald-600/40 to-transparent p-6 flex items-center justify-center animate-in slide-in-from-bottom duration-300">
                                        <div className="bg-white/90 backdrop-blur text-emerald-600 px-5 py-2.5 rounded-full font-black flex items-center space-x-2 shadow-xl scale-110">
                                            <CheckCircle size={22} />
                                            <span className="text-xs uppercase tracking-widest">¡Rostro Capturado!</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={toggleCamera}
                                className="w-full py-2 mb-2 mt-4 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium flex items-center justify-center space-x-2 text-xs"
                            >
                                <FlipHorizontal size={16} />
                                <span>Girar Cámara</span>
                            </button>
                            {capturedDescriptor ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCapturedDescriptor(null);
                                        setCapturedImage(null);
                                    }}
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

                        <div className="lg:w-1/2 p-6 md:p-8 lg:overflow-y-auto">
                            <h3 className="text-2xl font-bold text-slate-800 mb-6">
                                {editMode ? 'Editar Datos' : 'Nuevo Integrante'}
                            </h3>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">DNI (Identificación)</label>
                                    <input
                                        type="text"
                                        value={formData.dni}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                            setFormData({ ...formData, dni: val });
                                        }}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                        placeholder="Ingrese el DNI (solo números)"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Apellidos</label>
                                        <input
                                            type="text"
                                            value={formData.apellidos}
                                            onChange={(e) => setFormData({ ...formData, apellidos: e.target.value.toUpperCase() })}
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
                                            onChange={(e) => setFormData({ ...formData, nombres: e.target.value.toUpperCase() })}
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
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN PREMIUM */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-rose-100">
                                <AlertTriangle size={40} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">¿Estás seguro?</h3>
                            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                                Estas a punto de eliminar a <span className="font-bold text-slate-700">{deleteConfirm.apellidos}, {deleteConfirm.nombres}</span>. Esta acción no se puede deshacer.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="py-3.5 bg-rose-600 text-white rounded-2xl font-bold text-sm hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all active:scale-95"
                                >
                                    Sí, Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrantesPage;
