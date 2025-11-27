
import React from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

const ConfirmModal: React.FC<Props> = ({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onCancel, 
    confirmText = '确认', 
    cancelText = '取消',
    isDanger = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-fade-in-up border border-white/50">
        <div className="flex items-start gap-4 mb-4">
             {isDanger ? (
                 <div className="p-3 bg-red-50 rounded-full text-red-500 shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 </div>
             ) : (
                 <div className="p-3 bg-slate-100 rounded-full text-slate-500 shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
             )}
             <div>
                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed">{message}</p>
             </div>
        </div>
        
        <div className="flex gap-3 justify-end mt-6">
          <button 
            onClick={onCancel}
            className="px-5 py-2.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl font-medium transition active:scale-95"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`px-6 py-2.5 text-white rounded-xl font-medium shadow-lg transition active:scale-95 ${isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
