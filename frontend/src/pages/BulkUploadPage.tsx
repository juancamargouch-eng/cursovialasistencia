import { useState, useEffect, useCallback } from 'react';
import { FileUp, Loader2, CheckCircle, XCircle, AlertCircle, Building, Users, Image as ImageIcon, Archive, Cpu, Play } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { bulkUpload, bulkPhotosUpload, getIntegrantes, actualizarFaceDescriptor, getAuthenticatedFotoUrl } from '../services/api';
import type { Integrante } from '../types';

interface AxiosError {
    response?: {
        data?: {
            detail?: string;
        };
    };
}

const BulkUploadPage = () => {
    const [activeTab, setActiveTab] = useState<'data' | 'photos' | 'process'>('data');

    // State for Data Upload
    const [dataFile, setDataFile] = useState<File | null>(null);
    const [uploadingData, setUploadingData] = useState(false);
    const [dataResults, setDataResults] = useState<{
        message: string,
        stats: { creados: number, empresas_nuevas: number, omitidos: number, errores: number }
    } | null>(null);

    // State for Photos Upload
    const [photosFile, setPhotosFile] = useState<File | null>(null);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [photosResults, setPhotosResults] = useState<{
        message: string,
        stats: { procesados: number, actualizados: number, no_encontrados: number, errores: number }
    } | null>(null);

    // State for AI Processing
    const [integrantesSinDescriptor, setIntegrantesSinDescriptor] = useState<Integrante[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, errors: 0 });
    const [modelsLoaded, setModelsLoaded] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const loadModels = useCallback(async () => {
        if (modelsLoaded) return;
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
    }, [modelsLoaded]);

    const fetchPendingIntegrantes = useCallback(async () => {
        try {
            // Aumentamos el límite para procesar todos los pendientes de una sola vez
            const response = await getIntegrantes({ limit: 1000 });
            const pending = response.data.items.filter((i: Integrante) => i.tiene_foto && !i.face_descriptor);
            setIntegrantesSinDescriptor(pending);
        } catch (err) {
            console.error('Error loading integrantes:', err);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'process') {
            fetchPendingIntegrantes();
            loadModels();
        }
    }, [activeTab, fetchPendingIntegrantes, loadModels]);

    const handleUploadData = async () => {
        if (!dataFile) return;
        setUploadingData(true);
        setError(null);
        try {
            const response = await bulkUpload(dataFile);
            setDataResults(response.data);
            setDataFile(null);
        } catch (err: unknown) {
            let message = 'Error al procesar el archivo Excel. Verifique el formato.';
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as AxiosError;
                message = axiosError.response?.data?.detail || message;
            }
            setError(message);
        } finally {
            setUploadingData(false);
        }
    };

    const handleUploadPhotos = async () => {
        if (!photosFile) return;
        setUploadingPhotos(true);
        setError(null);
        try {
            const response = await bulkPhotosUpload(photosFile);
            setPhotosResults(response.data);
            setPhotosFile(null);
        } catch (err: unknown) {
            let message = 'Error al procesar el archivo ZIP. Verifique que no sea demasiado grande.';
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as AxiosError;
                message = axiosError.response?.data?.detail || message;
            }
            setError(message);
        } finally {
            setUploadingPhotos(false);
        }
    };

    const processDescriptors = async () => {
        if (!modelsLoaded || integrantesSinDescriptor.length === 0) return;

        setIsProcessing(true);
        setProcessProgress({ current: 0, total: integrantesSinDescriptor.length, errors: 0 });

        let errorsCount = 0;

        for (let i = 0; i < integrantesSinDescriptor.length; i++) {
            const inte = integrantesSinDescriptor[i];
            setProcessProgress(p => ({ ...p, current: i + 1 }));

            try {
                // 1. Cargar imagen desde el servidor
                // Usamos el DNI para la foto física ya que es compartida
                const img = await faceapi.fetchImage(getAuthenticatedFotoUrl(inte.dni));

                // 2. Detectar rostro y descriptor
                const detection = await faceapi.detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    // 3. Guardar en el servidor usando el ID del registro específico
                    // Aunque el backend sincronizará por DNI, usamos el ID para ser consistentes con la API
                    await actualizarFaceDescriptor(inte.id, Array.from(detection.descriptor));
                } else {
                    console.warn(`No se detectó rostro para DNI: ${inte.id}`);
                    errorsCount++;
                }
            } catch (err) {
                console.error(`Error procesando ID ${inte.id}:`, err);
                errorsCount++;
            }
        }

        setProcessProgress(p => ({ ...p, errors: errorsCount }));
        setIsProcessing(false);
        fetchPendingIntegrantes();
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="text-center space-y-2">
                <h3 className="text-3xl font-black text-slate-800">Módulo de Mantenimiento Masivo</h3>
                <p className="text-slate-500">Optimice y procese grandes volúmenes de información en pocos pasos</p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center p-1 bg-slate-100 rounded-2xl w-fit mx-auto border border-slate-200">
                <button
                    onClick={() => { setActiveTab('data'); setError(null); }}
                    className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 ${activeTab === 'data' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Building size={18} />
                    <span>1. Datos (Excel)</span>
                </button>
                <button
                    onClick={() => { setActiveTab('photos'); setError(null); }}
                    className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 ${activeTab === 'photos' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ImageIcon size={18} />
                    <span>2. Fotos (ZIP)</span>
                </button>
                <button
                    onClick={() => { setActiveTab('process'); setError(null); }}
                    className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center space-x-2 ${activeTab === 'process' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Cpu size={18} />
                    <span>3. Procesar IA</span>
                    {integrantesSinDescriptor.length > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                            {integrantesSinDescriptor.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'process' ? (
                // TAB PROCESAR IA
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-start space-x-4">
                            <div className="p-3 bg-amber-100 rounded-xl">
                                <AlertCircle className="text-amber-600" size={24} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-lg font-bold text-slate-800">Generación de Huellas Digitales Faciales</h4>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Para que el sistema reconozca a los alumnos al instante, necesitamos procesar las fotos subidas y convertirlas en datos matemáticos.
                                    Este proceso es intensivo y se realiza localmente en su navegador para mayor privacidad.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pendientes</p>
                                <p className="text-4xl font-black text-slate-800">{integrantesSinDescriptor.length}</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado de IA</p>
                                <p className={`text-sm font-bold ${modelsLoaded ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {modelsLoaded ? '✓ Modelos Listos' : 'Cargando Modelos...'}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center flex flex-col justify-center items-center">
                                <button
                                    onClick={processDescriptors}
                                    disabled={integrantesSinDescriptor.length === 0 || isProcessing || !modelsLoaded}
                                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all ${integrantesSinDescriptor.length === 0 || isProcessing || !modelsLoaded
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-[1.02] active:scale-95'
                                        }`}
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                                    <span>{isProcessing ? 'Procesando...' : 'Iniciar Procesamiento'}</span>
                                </button>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="space-y-4 animate-in fade-in zoom-in-95">
                                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${(processProgress.current / processProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <span>Procesando: {processProgress.current} de {processProgress.total}</span>
                                    <span className="text-emerald-600">{Math.round((processProgress.current / processProgress.total) * 100)}%</span>
                                </div>
                            </div>
                        )}

                        {processProgress.errors > 0 && !isProcessing && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center space-x-2 text-rose-700 text-sm">
                                <AlertCircle size={18} />
                                <span>No se pudo detectar el rostro en {processProgress.errors} imágenes. Asegúrese de que las fotos sean claras y miren al frente.</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // TABS DE CARGA (EXCEL / ZIP)
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Panel de Instrucciones */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="font-bold text-slate-800 flex items-center space-x-2">
                            <AlertCircle className="text-primary-500" size={20} />
                            <span>{activeTab === 'data' ? 'Instrucciones: Excel' : 'Instrucciones: Fotos ZIP'}</span>
                        </h4>

                        {activeTab === 'data' ? (
                            <>
                                <p className="text-sm text-slate-600">El archivo debe contener las siguientes columnas exactas:</p>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-[11px] space-y-2">
                                    <p className="text-primary-700 font-bold">AP_ALUMNO, NO_ALUMNO, EMPRESA, NRO_DOCUM</p>
                                    <hr className="border-slate-200" />
                                    <ul className="space-y-1 text-slate-500">
                                        <li>• <strong>AP_ALUMNO:</strong> Apellidos (Ej: PEREZ GARCIA)</li>
                                        <li>• <strong>NO_ALUMNO:</strong> Nombres (Ej: JUAN ALBERTO)</li>
                                        <li>• <strong>EMPRESA:</strong> Nombre de la empresa asociada.</li>
                                        <li>• <strong>NRO_DOCUM:</strong> DNI/Pasaporte (máx. 11 dígs).</li>
                                    </ul>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600">Prepare las fotos siguiendo estas reglas:</p>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                    <div className="flex items-start space-x-2 text-sm">
                                        <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                        <p className="text-slate-600">Nombre de cada imagen: <strong>DNI_DEL_ALUMNO.jpg</strong> (Ej: 12345678.jpg, 45678912.png)</p>
                                    </div>
                                    <div className="flex items-start space-x-2 text-sm">
                                        <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                        <p className="text-slate-600">Formatos permitidos: JPG, JPEG y PNG.</p>
                                    </div>
                                    <div className="flex items-start space-x-2 text-sm">
                                        <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                        <p className="text-slate-600">Empaquete todas las fotos en un solo archivo <strong>ZIP</strong>.</p>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs text-blue-800 leading-relaxed italic">
                                {activeTab === 'data'
                                    ? 'Las empresas que no existan se crearán automáticamente.'
                                    : 'Si el DNI en la foto no corresponde a un integrante registrado, será omitido.'}
                            </p>
                        </div>
                    </div>

                    {/* Zona de Carga */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-6">
                        <div className="w-full">
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-primary-400 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {activeTab === 'data' ? (
                                        <FileUp className={`w-12 h-12 mb-3 ${(dataFile) ? 'text-primary-600' : 'text-slate-400'}`} />
                                    ) : (
                                        <Archive className={`w-12 h-12 mb-3 ${(photosFile) ? 'text-primary-600' : 'text-slate-400'}`} />
                                    )}
                                    <p className="mb-2 text-sm text-slate-700">
                                        <span className="font-bold">Haga clic</span> o arrastre el archivo
                                    </p>
                                    <p className="text-xs text-slate-500">{activeTab === 'data' ? 'Excel (.xlsx, .xls)' : 'Archivo comprimido (.zip)'}</p>
                                    {(activeTab === 'data' ? dataFile : photosFile) && (
                                        <div className="mt-4 px-4 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-bold border border-primary-200">
                                            {(activeTab === 'data' ? dataFile?.name : photosFile?.name)}
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept={activeTab === 'data' ? ".xlsx, .xls" : ".zip"}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            if (activeTab === 'data') setDataFile(e.target.files[0]);
                                            else setPhotosFile(e.target.files[0]);
                                            setError(null);
                                        }
                                    }}
                                    disabled={uploadingData || uploadingPhotos}
                                />
                            </label>
                        </div>

                        <button
                            onClick={activeTab === 'data' ? handleUploadData : handleUploadPhotos}
                            disabled={(activeTab === 'data' ? !dataFile : !photosFile) || uploadingData || uploadingPhotos}
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all ${((activeTab === 'data' ? !dataFile : !photosFile) || uploadingData || uploadingPhotos)
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-[1.02] active:scale-95'
                                }`}
                        >
                            {(uploadingData || uploadingPhotos) ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>{activeTab === 'data' ? 'Cargando Excel...' : 'Cargando ZIP...'}</span>
                                </>
                            ) : (
                                <>
                                    {activeTab === 'data' ? <FileUp size={20} /> : <Archive size={20} />}
                                    <span>Iniciar Carga Masiva</span>
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="w-full p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center space-x-2 text-rose-700 text-sm">
                                <XCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Resultados Data */}
            {dataResults && activeTab === 'data' && (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-emerald-600">
                            <CheckCircle size={28} />
                            <h4 className="text-xl font-bold">Carga de Datos Exitosa</h4>
                        </div>
                        <button onClick={() => setDataResults(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Empresas Nuevas" value={dataResults.stats.empresas_nuevas} icon={<Building size={16} className="text-blue-500" />} />
                        <StatCard label="Integrantes" value={dataResults.stats.creados} icon={<Users size={16} className="text-emerald-500" />} />
                        <StatCard label="Omitidos" value={dataResults.stats.omitidos} color="text-amber-600" />
                        <StatCard label="Errores" value={dataResults.stats.errores} color="text-rose-600" />
                    </div>
                </div>
            )}

            {/* Resultados Photos */}
            {photosResults && activeTab === 'photos' && (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-emerald-600">
                            <CheckCircle size={28} />
                            <h4 className="text-xl font-bold">Carga de Fotos Exitosa</h4>
                        </div>
                        <button onClick={() => { setPhotosResults(null); setActiveTab('process'); }} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Fotos en ZIP" value={photosResults.stats.procesados} icon={<ImageIcon size={16} className="text-blue-500" />} />
                        <StatCard label="Almacenadas" value={photosResults.stats.actualizados} icon={<CheckCircle size={16} className="text-emerald-500" />} />
                        <StatCard label="Sin Registro DNI" value={photosResults.stats.no_encontrados} color="text-amber-600" />
                        <StatCard label="Errores" value={photosResults.stats.errores} color="text-rose-600" />
                    </div>
                    <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl text-center flex items-center justify-center space-x-4">
                        <p className="text-sm text-primary-800 font-medium">
                            <strong>¡Paso Siguiente!</strong> Las fotos están en el servidor, pero falta generar las "huellas faciales".
                        </p>
                        <button
                            onClick={() => setActiveTab('process')}
                            className="bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors"
                        >
                            Ir a Procesar IA
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, color = "text-slate-800" }: { label: string, value: number, icon?: React.ReactNode, color?: string }) => (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{label}</p>
        <div className="flex items-center justify-center space-x-2">
            {icon}
            <span className={`text-2xl font-black ${color}`}>{value}</span>
        </div>
    </div>
);

export default BulkUploadPage;
