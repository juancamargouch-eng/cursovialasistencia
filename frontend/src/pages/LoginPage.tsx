import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ShieldCheck, LogIn, Loader2, AlertCircle, Eye, EyeOff, Lock, User, Car, Bike } from 'lucide-react';
import { loginUser, API_URL } from '../services/api';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            console.log('LoginPage: Enviando credenciales...');
            const response = await loginUser(formData);
            console.log('LoginPage: Respuesta recibida:', response.data);

            if (response.data && response.data.access_token) {
                console.log('LoginPage: Token detectado, ejecutando login');
                setIsSuccess(true);
                // Ejecutamos el login inmediatamente
                login(response.data.access_token);
            } else {
                console.error('LoginPage: Respuesta exitosa pero sin token:', response.data);
                setError('El servidor no devolvió un token de acceso.');
                setLoading(false);
            }
        } catch (err: unknown) {
            console.error('LoginPage: Error en la petición:', err);
            if (axios.isAxiosError(err)) {
                if (!err.response) {
                    // Si no hay respuesta, es probable que sea un error de certificado (ERR_CERT_AUTHORITY_INVALID)
                    setError('ERROR_DE_RED_SSL');
                } else {
                    setError(err.response?.data?.detail || 'Credenciales incorrectas');
                }
            } else {
                setError('Error de conexión con el servidor');
            }
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden transition-all duration-700 ${isSuccess ? 'scale-110 opacity-0 blur-lg' : 'scale-100'}`}>

            {/* FONDO REALISTA: CARRETERA 3D Y TRÁFICO */}
            <div className="absolute inset-0 z-0 road-perspective">
                {/* Gradientes Atmosféricos */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e293b_0%,_#020617_100%)] opacity-80" />

                {/* Superficie de la Carretera */}
                <div className="road-surface">
                    <div className="road-lines" />
                </div>

                {/* Tráfico: Autos y Motos persistentes */}
                <div className="parallax-layer flex justify-center">
                    {/* Moto 1 (Carril Izquierdo) */}
                    <div className="absolute left-[35%] animate-vehicle opacity-0 text-primary-400/20">
                        <Bike size={80} strokeWidth={1} />
                    </div>

                    {/* Auto 1 (Carril Derecho) */}
                    <div className="absolute left-[65%] animate-vehicle-delayed opacity-0 text-slate-500/10">
                        <Car size={120} strokeWidth={1} />
                    </div>

                    {/* Moto 2 (Rápida - Fondo) */}
                    <div className="absolute left-[48%] animate-vehicle opacity-0 text-primary-500/15" style={{ animationDelay: '2s' }}>
                        <Bike size={60} strokeWidth={1.5} />
                    </div>
                </div>

                {/* Luces de la Ciudad Distante */}
                <div className="absolute top-[30%] left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-500/20 to-transparent blur-md" />
                <div className="absolute top-[29%] left-1/2 -translate-x-1/2 flex space-x-1">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-1 h-1 bg-amber-500/40 rounded-full blur-[1px]" />
                    ))}
                </div>
            </div>

            {/* FORMULARIO DE ACCESO (GLASSMORPHISMO REFORZADO) */}
            <div className={`relative z-10 max-w-md w-full transition-all duration-500 ${loading ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="text-center mb-10">
                    <div className="relative inline-block group">
                        <div className="absolute inset-0 bg-primary-500 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative inline-flex items-center justify-center w-24 h-24 bg-primary-600 rounded-[2.8rem] shadow-2xl shadow-primary-500/40 mb-6 animate-float">
                            <ShieldCheck size={48} className="text-white drop-shadow-lg" />
                        </div>
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-2 italic drop-shadow-2xl">
                        Asiste<span className="text-primary-400">Curso</span>Vial
                    </h1>
                    <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Portal de Seguridad Vial</p>
                    </div>
                </div>

                <div className="glass p-8 md:p-10 rounded-[3.5rem] relative group border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    {/* Efecto de Brillo al Pasar Cursor */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shine pointer-events-none" />

                    <form onSubmit={handleSubmit} className="space-y-6 relative">
                        {error && (
                            <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-3xl flex items-center space-x-3 text-rose-500">
                                    <div className="bg-rose-500 rounded-full p-1 shadow-lg shadow-rose-500/20">
                                        <AlertCircle size={16} className="text-white" />
                                    </div>
                                    <p className="text-xs font-black uppercase tracking-tight">
                                        {error === 'ERROR_DE_RED_SSL' ? 'Error de Seguridad SSL' : error}
                                    </p>
                                </div>

                                {error === 'ERROR_DE_RED_SSL' && (
                                    <div className="bg-slate-900/80 border border-primary-500/30 p-4 rounded-3xl text-[10px] font-bold text-slate-300 space-y-2 leading-relaxed backdrop-blur-md">
                                        <p className="text-primary-400 uppercase tracking-widest text-[9px] mb-1">⚠️ Acción Requerida:</p>
                                        <p>El navegador bloqueó la conexión por seguridad (HTTPS Local).</p>
                                        <p>1. <a href={`${API_URL}/token`} target="_blank" rel="noreferrer" className="text-blue-400 underline font-black">Haz clic aquí para autorizar el acceso</a></p>
                                        <p>2. Clic en "Opciones Avanzadas" y después en "Acceder/Proceder".</p>
                                        <p>3. Regresa aquí e intenta ingresar de nuevo.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-6 flex items-center gap-2 drop-shadow-sm">
                                <User size={12} /> Usuario Administrativo
                            </label>
                            <div className="relative">
                                <input
                                    required
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-950/60 border-2 border-slate-800/80 text-white px-8 py-5 rounded-[2rem] outline-none focus:border-primary-500 transition-all font-bold placeholder:text-slate-700 focus:shadow-[0_0_40px_rgba(14,165,233,0.15)] focus:bg-slate-900"
                                    placeholder="Nombre de usuario"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-6 flex items-center gap-2 drop-shadow-sm">
                                <Lock size={12} /> Contraseña de Acceso
                            </label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950/60 border-2 border-slate-800/80 text-white px-8 py-5 rounded-[2rem] outline-none focus:border-primary-500 transition-all font-bold placeholder:text-slate-700 focus:shadow-[0_0_40px_rgba(14,165,233,0.15)] focus:bg-slate-900"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 hover:text-primary-400 transition-colors p-2 active:scale-90"
                                >
                                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                            </div>
                        </div>

                        <button
                            disabled={loading || isSuccess}
                            type="submit"
                            className={`w-full relative group/btn overflow-hidden py-5 rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] transition-all active:scale-95 shadow-2xl flex items-center justify-center
                                ${isSuccess ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-primary-600 hover:bg-primary-500 shadow-primary-500/20'}
                            `}
                        >
                            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500 ease-out" />
                            <span className="relative z-10 flex items-center gap-3 text-white">
                                {loading ? (
                                    <Loader2 className="animate-spin" size={24} />
                                ) : isSuccess ? (
                                    <>¡BIENVENIDO! <ShieldCheck size={20} /></>
                                ) : (
                                    <>INGRESAR <LogIn size={20} /></>
                                )}
                            </span>
                        </button>
                    </form>
                </div>

                <div className="mt-12 text-center">
                    <div className="flex justify-center items-center space-x-6">
                        <div className="h-px w-8 bg-slate-800" />
                        <div className="flex space-x-3">
                            <Car size={16} className="text-slate-700" />
                            <Bike size={16} className="text-slate-700" />
                        </div>
                        <div className="h-px w-8 bg-slate-800" />
                    </div>
                    <p className="mt-4 text-[9px] text-slate-600 font-black uppercase tracking-[0.5em]">
                        &copy; 2026 CursoVial &bull; Specialized Education
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
