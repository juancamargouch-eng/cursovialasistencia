import { LayoutDashboard, Users, Building2, Camera, LogOut, FileUp, Calendar, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    to: string;
    onClick?: () => void;
}

const SidebarItem = ({ icon: Icon, label, to, onClick }: SidebarItemProps) => (
    <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) => `
            w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors 
            ${isActive
                ? 'bg-primary-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }
        `}
    >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
    </NavLink>
);

interface SidebarProps {
    onClose?: () => void;
}

const Sidebar = ({ onClose }: SidebarProps) => {
    const { logout } = useAuth();

    return (
        <div className="w-64 bg-slate-900 h-screen flex flex-col p-4 text-white shadow-2xl relative">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
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
                    to="/"
                    onClick={onClose}
                />
                <SidebarItem
                    icon={Building2}
                    label="Asociaciones"
                    to="/asociaciones"
                    onClick={onClose}
                />
                <SidebarItem
                    icon={Users}
                    label="Integrantes"
                    to="/integrantes"
                    onClick={onClose}
                />
                <SidebarItem
                    icon={Camera}
                    label="Asistencia"
                    to="/asistencia"
                    onClick={onClose}
                />
                <SidebarItem
                    icon={FileUp}
                    label="Carga Masiva"
                    to="/bulk-upload"
                    onClick={onClose}
                />
                <SidebarItem
                    icon={Calendar}
                    label="Cursos y Reportes"
                    to="/cursos"
                    onClick={onClose}
                />
            </nav>

            <div className="mt-auto border-t border-slate-800 pt-4">
                <button
                    onClick={logout}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-rose-900/20 hover:text-rose-500 transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Cerrar Sesión</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
