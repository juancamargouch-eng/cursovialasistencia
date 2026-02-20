import { LayoutDashboard, Users, Building2, Camera, LogOut, FileUp, Calendar, X } from 'lucide-react';

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    onClick: () => void;
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${active
            ? 'bg-primary-600 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
    >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
    </button>
);

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onClose?: () => void;
}

const Sidebar = ({ activeTab, setActiveTab, onClose }: SidebarProps) => {
    return (
        <div className="w-64 bg-slate-900 h-screen flex flex-col p-4 text-white shadow-2xl relative">
            {onClose && (
                <button
                    onClick={onClose}
                    className="lg:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
                >
                    <X size={24} />
                </button>
            )}
            <div className="flex items-center space-x-2 px-2 mb-10 mt-2">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                    <Camera size={20} className="text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">CursoVial</h1>
            </div>

            <nav className="flex-1 space-y-2">
                <SidebarItem
                    icon={LayoutDashboard}
                    label="Dashboard"
                    active={activeTab === 'dashboard'}
                    onClick={() => setActiveTab('dashboard')}
                />
                <SidebarItem
                    icon={Building2}
                    label="Asociaciones"
                    active={activeTab === 'asociaciones'}
                    onClick={() => setActiveTab('asociaciones')}
                />
                <SidebarItem
                    icon={Users}
                    label="Integrantes"
                    active={activeTab === 'integrantes'}
                    onClick={() => setActiveTab('integrantes')}
                />
                <SidebarItem
                    icon={Camera}
                    label="Asistencia"
                    active={activeTab === 'asistencia'}
                    onClick={() => setActiveTab('asistencia')}
                />
                <SidebarItem
                    icon={FileUp}
                    label="Carga Masiva"
                    active={activeTab === 'bulk-upload'}
                    onClick={() => setActiveTab('bulk-upload')}
                />
                <SidebarItem
                    icon={Calendar}
                    label="Cursos y Reportes"
                    active={activeTab === 'cursos'}
                    onClick={() => setActiveTab('cursos')}
                />
            </nav>

            <div className="mt-auto border-t border-slate-800 pt-4">
                <SidebarItem
                    icon={LogOut}
                    label="Cerrar Sesión"
                    onClick={() => console.log('Logout')}
                />
            </div>
        </div>
    );
};

export default Sidebar;
