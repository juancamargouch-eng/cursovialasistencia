import { useState, useEffect, useMemo, useDeferredValue, memo } from 'react';
import { Calendar, FileText, CheckCircle, XCircle, Plus, Loader2 } from 'lucide-react';
import { getCursos, crearCurso, getReporteAsistencia, API_URL } from '../services/api';

interface Curso {
    id: number;
    nombre: string;
    fecha: string;
}

interface ReporteItem {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    empresa: string;
    tiene_foto: boolean;
    asistio: boolean;
}

const ReportRow = memo(({ item }: { item: ReporteItem }) => {
    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-6 py-4">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                        <img
                            src={item.tiene_foto ? `${API_URL}/fotos/${item.dni}.jpg` : `https://ui-avatars.com/api/?name=${item.nombres}&background=random`}
                            className="w-full h-full object-cover"
                            alt=""
                        />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">{item.apellidos}, {item.nombres}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{item.dni}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-slate-500">{item.empresa}</td>
            <td className="px-6 py-4 text-center">
                {item.asistio ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full font-bold text-[10px] uppercase">
                        <CheckCircle size={12} />
                        <span>Presente</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full font-bold text-[10px] uppercase">
                        <XCircle size={12} />
                        <span>Faltante</span>
                    </span>
                )}
            </td>
        </tr>
    );
});

const CoursesPage = () => {
    const [cursos, setCursos] = useState<Curso[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCurso, setNewCurso] = useState({ nombre: '', fecha: '' });
    const [saving, setSaving] = useState(false);

    // Report State
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [reporte, setReporte] = useState<ReporteItem[]>([]);
    const [loadingReport, setLoadingReport] = useState(false);
    const [filterBy, setFilterBy] = useState<'all' | 'present' | 'absent'>('all');

    // Defer filtering to keep UI responsive
    const deferredFilterBy = useDeferredValue(filterBy);

    useEffect(() => {
        fetchCursos();
    }, []);

    // Debounce para evitar peticiones mientras se escribe la fecha
    useEffect(() => {
        if (!selectedDate || selectedDate.length < 10) return;

        const timeoutId = setTimeout(() => {
            fetchReporte(selectedDate);
        }, 500); // 500ms de espera

        return () => clearTimeout(timeoutId);
    }, [selectedDate]);

    const fetchCursos = async () => {
        try {
            const res = await getCursos();
            setCursos(res.data);
        } catch (error) {
            console.error('Error fetching cursos:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReporte = async (fecha: string) => {
        setLoadingReport(true);
        try {
            const res = await getReporteAsistencia(fecha);
            setReporte(res.data);
        } catch (error) {
            console.error('Error fetching reporte:', error);
        } finally {
            setLoadingReport(false);
        }
    };

    const handleCreateCurso = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await crearCurso(newCurso);
            setIsModalOpen(false);
            setNewCurso({ nombre: '', fecha: '' });
            fetchCursos();
        } catch (error) {
            console.error('Error creating curso:', error);
        } finally {
            setSaving(false);
        }
    };

    const filteredReport = useMemo(() => {
        return reporte.filter(item => {
            if (deferredFilterBy === 'present') return item.asistio;
            if (deferredFilterBy === 'absent') return !item.asistio;
            return true;
        });
    }, [reporte, deferredFilterBy]);

    const stats = useMemo(() => ({
        total: reporte.length,
        present: reporte.filter(i => i.asistio).length,
        absent: reporte.filter(i => !i.asistio).length
    }), [reporte]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Cursos y Reportes</h3>
                    <p className="text-slate-500">Control de asistencia por fecha de capacitación</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    <span>Crear Nuevo Curso</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Lateral: Lista de Cursos Recientes */}
                <div className="space-y-4">
                    <h4 className="font-bold text-slate-700 flex items-center space-x-2 px-2">
                        <Calendar size={18} className="text-primary-500" />
                        <span>Próximos Cursos</span>
                    </h4>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                        ) : cursos.length === 0 ? (
                            <p className="p-8 text-center text-slate-400 text-sm italic">No hay cursos registrados</p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {cursos.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedDate(c.fecha.split('T')[0])}
                                        className={`w-full p-4 text-left hover:bg-primary-50 transition-colors group ${selectedDate === c.fecha.split('T')[0] ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''}`}
                                    >
                                        <p className="font-bold text-slate-800 text-sm">{c.nombre}</p>
                                        <p className="text-xs text-slate-500 mt-1">{new Date(c.fecha).toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Principal: Reporte Comparativo */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Header Reporte */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-primary-100 rounded-xl">
                                <FileText className="text-primary-600" size={24} />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-800">Reporte de Asistencia</h4>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="text-sm text-primary-600 font-medium outline-none border-none p-0 bg-transparent cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                            <button
                                onClick={() => setFilterBy('all')}
                                className={`flex-1 md:px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterBy === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                            >
                                Todos ({stats.total})
                            </button>
                            <button
                                onClick={() => setFilterBy('present')}
                                className={`flex-1 md:px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterBy === 'present' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                Presentes ({stats.present})
                            </button>
                            <button
                                onClick={() => setFilterBy('absent')}
                                className={`flex-1 md:px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${filterBy === 'absent' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                Faltantes ({stats.absent})
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Reporte */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {loadingReport ? (
                            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary-500" size={40} /></div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Integrante</th>
                                        <th className="px-6 py-4">Empresa</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredReport.map(item => (
                                        <ReportRow key={item.id} item={item} />
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Crear Curso */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-8 space-y-6">
                        <h4 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                            <Calendar className="text-primary-500" />
                            <span>Programar Nuevo Curso</span>
                        </h4>
                        <form onSubmit={handleCreateCurso} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nombre del Curso</label>
                                <input
                                    type="text"
                                    required
                                    value={newCurso.nombre}
                                    onChange={(e) => setNewCurso({ ...newCurso, nombre: e.target.value })}
                                    placeholder="Ej: Curso de Seguridad Vial 1"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Programada</label>
                                <input
                                    type="date"
                                    required
                                    value={newCurso.fecha}
                                    onChange={(e) => setNewCurso({ ...newCurso, fecha: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all flex items-center justify-center space-x-2"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Guardar Curso</span>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoursesPage;
