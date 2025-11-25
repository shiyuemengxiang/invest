
import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Props {
    message: string;
    type: ToastType;
    onClose: () => void;
}

const Toast: React.FC<Props> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const config = {
        success: {
            bg: 'bg-emerald-600',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        },
        error: {
            bg: 'bg-red-500',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        },
        info: {
            bg: 'bg-slate-800',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
    };

    const style = config[type];

    return (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[110] animate-fade-in-up">
            <div className={`${style.bg} text-white px-6 py-3.5 rounded-2xl shadow-xl shadow-slate-300/50 flex items-center gap-3 min-w-[300px] justify-center backdrop-blur-md bg-opacity-95`}>
                <div className="shrink-0 opacity-90">{style.icon}</div>
                <span className="font-bold text-sm tracking-wide">{message}</span>
                <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100 transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};

export default Toast;
