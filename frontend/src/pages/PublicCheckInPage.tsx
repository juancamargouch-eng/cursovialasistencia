import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, User, Building, CheckCircle2, Scan, XCircle } from 'lucide-react';
import { getAuthenticatedFotoUrl } from '../services/api';

interface AttendanceMessage {
    type: 'FACE_RECOGNIZED' | 'SUCCESS' | 'ALREADY_MARKED' | 'RESET';
    payload?: {
        dni: string;
        nombres: string;
        apellidos: string;
        asociacion: string;
    }
}

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

const PublicCheckInPage = () => {
    const [status, setStatus] = useState<'idle' | 'recognized' | 'success' | 'already_marked'>('idle');
    const [data, setData] = useState<AttendanceMessage['payload'] | null>(null);
    const [audioReady, setAudioReady] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);

    const initAudio = async () => {
        if (!audioContextRef.current) {
            const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
            if (AudioContextClass) {
                audioContextRef.current = new AudioContextClass();
            }
        }
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        setAudioReady(true);
    };

    const playSuccessSound = () => {
        if (!audioContextRef.current) return;
        try {
            const context = audioContextRef.current;
            if (context.state === 'suspended') context.resume();

            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, context.currentTime); // La5
            oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.1); // Mi6

            gain.gain.setValueAtTime(0.1, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start();
            oscillator.stop(context.currentTime + 0.5);
        } catch (e) {
            console.error("Error reproduciendo éxito:", e);
        }
    };

    const playWarningSound = () => {
        if (!audioContextRef.current) return;
        try {
            const context = audioContextRef.current;
            if (context.state === 'suspended') context.resume();

            const playTone = (freq: number, start: number, duration: number) => {
                const osc = context.createOscillator();
                const g = context.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, context.currentTime + start);
                g.gain.setValueAtTime(0.05, context.currentTime + start);
                g.gain.exponentialRampToValueAtTime(0.01, context.currentTime + start + duration);
                osc.connect(g);
                g.connect(context.destination);
                osc.start(context.currentTime + start);
                osc.stop(context.currentTime + start + duration);
            };
            // Doble pitido grave
            playTone(220, 0, 0.2);
            playTone(180, 0.25, 0.3);
        } catch (e) {
            console.error("Error reproduciendo advertencia:", e);
        }
    };

    useEffect(() => {
        const channel = new BroadcastChannel('attendance_updates');

        channel.onmessage = (event: MessageEvent<AttendanceMessage>) => {
            const { type, payload } = event.data;

            if (type === 'FACE_RECOGNIZED' && payload) {
                setData(payload);
                setStatus('recognized');
            } else if (type === 'SUCCESS') {
                setStatus('success');
                playSuccessSound();
            } else if (type === 'ALREADY_MARKED') {
                setStatus('already_marked');
                playWarningSound();
            } else if (type === 'RESET') {
                setStatus('idle');
                setData(null);
            }
        };

        return () => channel.close();
    }, []);

    // Auto-reset después de un tiempo si se queda en un estado activo
    useEffect(() => {
        if (status !== 'idle') {
            const timeout = status === 'already_marked' ? 6000 : 10000;
            const timer = setTimeout(() => {
                setStatus('idle');
                setData(null);
            }, timeout);
            return () => clearTimeout(timer);
        }
    }, [status]);

    return (
        <div
            className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden cursor-pointer"
            onClick={initAudio}
        >
            {/* Audio Activation Alert */}
            {!audioReady && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <div className="bg-primary-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 border-2 border-white/20">
                        <Scan size={20} />
                        <span className="font-bold uppercase tracking-widest text-sm">Haga clic aquí para activar el sonido</span>
                    </div>
                </div>
            )}
            {/* Background Orbs */}
            <div className="absolute top-0 -left-20 w-96 h-96 bg-primary-600/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-0 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] animate-pulse"></div>

            <div className="relative w-full max-w-[95vw]">
                {status === 'idle' ? (
                    <div className="text-center space-y-16 animate-in fade-in zoom-in duration-500">
                        <div className="w-64 h-64 bg-slate-900 border-4 border-slate-800 rounded-full flex items-center justify-center mx-auto shadow-2xl relative">
                            <Scan size={128} className="text-primary-500 animate-pulse" />
                            <div className="absolute inset-0 border-8 border-primary-500/20 rounded-full animate-ping"></div>
                        </div>
                        <div className="space-y-6">
                            <h1 className="text-8xl md:text-[12rem] font-black text-white tracking-tighter leading-none">
                                BIENVENIDO
                            </h1>
                            <p className="text-slate-400 text-4xl md:text-6xl font-medium">
                                Por favor, aproxime su rostro a la cámara
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-12 md:p-20 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                        <div className="flex flex-col xl:flex-row items-center gap-12 xl:gap-24">
                            {/* Foto Section */}
                            <div className="relative shrink-0">
                                <div className="w-[28rem] h-[35rem] md:w-[35rem] md:h-[45rem] rounded-[4rem] border-[16px] border-slate-800 overflow-hidden shadow-2xl bg-slate-800">
                                    {data?.dni && (
                                        <img
                                            src={getAuthenticatedFotoUrl(data.dni)}
                                            alt="Perfil"
                                            className="w-full h-full object-cover scale-110"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nombres + ' ' + data.apellidos)}&background=random&size=512`;
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="absolute -bottom-10 -right-10 bg-emerald-500 text-white p-8 rounded-[2.5rem] border-[12px] border-slate-900 shadow-2xl">
                                    <ShieldCheck size={80} />
                                </div>
                            </div>

                            {/* Data Section */}
                            <div className="flex-1 text-center md:text-left space-y-6">
                                <div className="space-y-4">
                                    <span className="text-emerald-400 font-bold uppercase tracking-[0.4em] text-3xl">
                                        Integrante Identificado
                                    </span>
                                    <h2 className="text-6xl md:text-[8rem] lg:text-[10rem] font-black text-white leading-[0.85] uppercase tracking-tighter">
                                        {data?.apellidos}<br />
                                        <span className="text-white/80">{data?.nombres}</span>
                                    </h2>
                                </div>

                                <div className="flex flex-wrap justify-center md:justify-start gap-10">
                                    <div className="bg-slate-800/80 px-10 py-5 rounded-3xl flex items-center space-x-5 border-2 border-white/10">
                                        <Building size={48} className="text-primary-400" />
                                        <span className="text-slate-200 font-black uppercase text-4xl">
                                            {data?.asociacion}
                                        </span>
                                    </div>
                                    <div className="bg-slate-800/80 px-10 py-5 rounded-3xl flex items-center space-x-5 border-2 border-white/10 font-mono">
                                        <User size={48} className="text-slate-400" />
                                        <span className="text-slate-300 font-black tracking-[0.3em] text-4xl">
                                            {data?.dni}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-12">
                                    {status === 'success' ? (
                                        <div className="flex items-center justify-center md:justify-start space-x-10 text-emerald-400 animate-in zoom-in duration-300">
                                            <CheckCircle2 size={128} className="animate-bounce" />
                                            <div className="text-left space-y-2">
                                                <span className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter block leading-none">
                                                    ¡ASISTENCIA REGISTRADA!
                                                </span>
                                                <span className="text-3xl font-bold text-emerald-500/80 uppercase tracking-widest">Que tenga un excelente viaje</span>
                                            </div>
                                        </div>
                                    ) : status === 'already_marked' ? (
                                        <div className="flex items-center justify-center md:justify-start space-x-10 text-amber-500 animate-in shake duration-500">
                                            <XCircle size={128} />
                                            <div className="text-left space-y-2">
                                                <span className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tighter block leading-none">
                                                    YA MARCÓ ASISTENCIA
                                                </span>
                                                <span className="text-3xl font-bold opacity-80 uppercase tracking-widest">No es necesario marcar de nuevo</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center md:justify-start space-x-10 text-primary-400">
                                            <div className="w-10 h-10 bg-primary-500 rounded-full animate-ping"></div>
                                            <span className="text-5xl font-black uppercase tracking-[0.2em]">
                                                Confirmando Identidad...
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer info */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">
                    Sistema de Reconocimiento Facial • CursoVial
                </p>
            </div>
        </div>
    );
};

export default PublicCheckInPage;
