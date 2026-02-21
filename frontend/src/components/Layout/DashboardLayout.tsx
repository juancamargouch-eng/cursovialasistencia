import { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Outlet, useLocation } from 'react-router-dom';

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
    const { logout } = useAuth();
    const location = useLocation();

    // Obtener el nombre de la sección actual basado en la ruta
    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        if (path.includes('bulk-upload')) return 'Carga Masiva';
        if (path.includes('cursos')) return 'Cursos y Reportes';
        return path.replace(/^\//, '');
    };

    return (
        <div className="flex h-screen bg-slate-50 relative overflow-hidden">
            {/* Sidebar Overlay for Mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className={`fixed lg:absolute inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
                <Sidebar
                    onClose={() => setIsSidebarOpen(false)}
                />
            </div>

            <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
                <header className="bg-white border-b border-slate-200 py-3 px-4 md:px-8 sticky top-0 z-30">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Menu size={24} />
                            </button>
                            <h2 className="text-lg md:text-xl font-bold text-slate-800 capitalize">
                                {getPageTitle()}
                            </h2>
                        </div>
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-3 border-r border-slate-200 pr-6">
                                <div className="hidden md:flex flex-col items-end">
                                    <span className="text-xs font-bold text-slate-800 leading-none">Admin</span>
                                    <span className="text-[10px] text-slate-500">Administrador</span>
                                </div>
                                <div className="w-9 h-9 bg-primary-100 border border-primary-200 text-primary-700 rounded-full flex items-center justify-center font-bold">
                                    AD
                                </div>
                            </div>
                            <button
                                onClick={logout}
                                className="flex items-center space-x-2 text-slate-400 hover:text-rose-600 transition-colors group"
                                title="Cerrar Sesión"
                            >
                                <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
                                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Salir</span>
                            </button>
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-8 overflow-y-auto flex-1 h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
