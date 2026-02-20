import { useState, useEffect } from 'react';
import { Plus, Building2, Loader2 } from 'lucide-react';
import { getAsociaciones, crearAsociacion } from '../services/api';
import type { Asociacion } from '../types';

const AsociacionesPage = () => {
    const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [nombre, setNombre] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchAsociaciones();
    }, []);

    const fetchAsociaciones = async () => {
        try {
            const response = await getAsociaciones();
            setAsociaciones(response.data);
        } catch (error) {
            console.error('Error fetching asociaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        setSaving(true);
        try {
            await crearAsociacion({ nombre });
            setNombre('');
            setIsModalOpen(false);
            fetchAsociaciones();
        } catch (error) {
            console.error('Error creating asociacion:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800">Asociaciones</h3>
                    <p className="text-slate-500">Gestión de empresas de mototaxis</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    <span>Nueva Asociación</span>
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center">
                        <Loader2 className="animate-spin text-primary-500" size={32} />
                    </div>
                ) : asociaciones.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-slate-500 italic">No hay asociaciones registradas.</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Nombre</th>
                                <th className="px-6 py-4">Fecha de Registro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {asociaciones.map((asoc) => (
                                <tr key={asoc.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-400">#{asoc.id}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        <div className="flex items-center space-x-2">
                                            <Building2 size={16} className="text-slate-400" />
                                            <span>{asoc.nombre}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        {new Date(asoc.fecha_registro).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold mb-4">Registrar Asociación</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none"
                                    placeholder="Ej: Asociación San Pedro"
                                    required
                                />
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm flex items-center justify-center space-x-2"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <span>Guardar</span>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AsociacionesPage;
