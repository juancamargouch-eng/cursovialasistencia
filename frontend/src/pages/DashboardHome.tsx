import { useState, useEffect } from 'react';
import { Users, Building2, CheckCircle, Loader2, User, XCircle } from 'lucide-react';
import { getAsociaciones, getIntegrantes, getAsistencias, API_URL } from '../services/api';
import type { Asistencia } from '../types';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    loading?: boolean;
}

const StatCard = ({ label, value, icon: Icon, color, loading }: StatCardProps) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon size={24} className="text-white" />
        </div>
        <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            {loading ? <Loader2 className="animate-spin text-slate-300" size={20} /> : (
                <p className="text-2xl font-bold text-slate-900">{value}</p>
            )}
        </div>
    </div>
);

const DashboardHome = () => {
    const [stats, setStats] = useState({ asistencias: 0, asociaciones: 0, integrantes: 0 });
    const [asistenciasHoy, setAsistenciasHoy] = useState<Asistencia[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [asoc, int, asis] = await Promise.all([
                    getAsociaciones(),
                    getIntegrantes({ limit: 1 }), // Solo queremos el total
                    getAsistencias()
                ]);

                const today = new Date().toISOString().split('T')[0];
                const listAsis = (asis.data as Asistencia[]).filter(a => a.fecha.startsWith(today));

                setAsistenciasHoy(listAsis);
                setStats({
                    asociaciones: asoc.data.length,
                    integrantes: int.data.total ?? int.data.length,
                    asistencias: listAsis.length
                });
                setConnectionError(false);
            } catch (error) {
                console.error('Error fetching stats:', error);
                setConnectionError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="space-y-8">
            {connectionError && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center space-x-3 text-rose-700">
                        <XCircle size={24} />
                        <div>
                            <p className="font-bold text-sm">Error de Conexión con el Servidor</p>
                            <p className="text-xs opacity-80">Debe autorizar el certificado de la API (puerto 8000) para ver las estadísticas.</p>
                        </div>
                    </div>
                    <a
                        href={`${API_URL}/asociaciones/`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-rose-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-md active:scale-95"
                    >
                        Autorizar Conexión
                    </a>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Asistencias de Hoy"
                    value={stats.asistencias}
                    icon={CheckCircle}
                    color="bg-emerald-500"
                    loading={loading}
                />
                <StatCard
                    label="Asociaciones"
                    value={stats.asociaciones}
                    icon={Building2}
                    color="bg-blue-500"
                    loading={loading}
                />
                <StatCard
                    label="Total Integrantes"
                    value={stats.integrantes}
                    icon={Users}
                    color="bg-primary-500"
                    loading={loading}
                />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800">Control de Asistencias del Día</h3>
                    <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                        Hoy: {new Date().toLocaleDateString('es-PE')}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Hora</th>
                                <th className="px-6 py-4">DNI</th>
                                <th className="px-6 py-4">Integrantes</th>
                                <th className="px-6 py-4">Empresa / Asociación</th>
                                <th className="px-6 py-4">Foto</th>
                                <th className="px-6 py-4 text-center">Turno</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                        Cargando datos...
                                    </td>
                                </tr>
                            ) : asistenciasHoy.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                                        No se han registrado asistencias el día de hoy.
                                    </td>
                                </tr>
                            ) : (
                                asistenciasHoy.map((a) => (
                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {new Date(a.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-600 text-sm">{a.dni_integrante}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{a.apellidos}, {a.nombres}</td>
                                        <td className="px-6 py-4 text-slate-500">{a.nombre_asociacion}</td>
                                        <td className="px-6 py-4">
                                            {a.tiene_foto ? (
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                                                    <User size={16} className="text-emerald-600" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                                    <User size={16} className="text-slate-400" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${a.turno === 'Mañana' ? 'bg-amber-100 text-amber-700' :
                                                a.turno === 'Tarde' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                                                }`}>
                                                {a.turno}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
