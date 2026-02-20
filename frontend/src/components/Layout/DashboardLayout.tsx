import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface DashboardLayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const DashboardLayout = ({ children, activeTab, setActiveTab }: DashboardLayoutProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { logout } = useAuth();

    return (
        <div className="flex h-screen bg-slate-50 relative overflow-hidden">
            {/* Sidebar Overlay for Mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className={`fixed lg:static inset-y-0 left-0 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
                <Sidebar
                    activeTab={activeTab}
                    setActiveTab={(tab) => { setActiveTab(tab); setIsSidebarOpen(false); }}
                    onClose={() => setIsSidebarOpen(false)}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0">
                <header className="bg-white border-b border-slate-200 py-3 px-4 md:px-8 sticky top-0 z-30">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <Menu size={24} />
                            </button>
                            <h2 className="text-lg md:text-xl font-bold text-slate-800 capitalize">
                                {activeTab === 'bulk-upload' ? 'Carga Masiva' :
                                    activeTab === 'cursos' ? 'Cursos y Reportes' :
                                        activeTab}
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
                    {children}
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
