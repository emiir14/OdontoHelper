import React from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const Toast: React.FC = () => {
  const { toastMessage } = useAppStore();

  if (!toastMessage) return null;

  const Icon =
    toastMessage.type === 'success'
      ? CheckCircle2
      : toastMessage.type === 'warning'
      ? AlertTriangle
      : Info;

  const colorClass =
    toastMessage.type === 'success'
      ? 'bg-teal-900/90 text-teal-100 border-teal-700/80'
      : toastMessage.type === 'warning'
      ? 'bg-amber-900/90 text-amber-100 border-amber-700/80'
      : 'bg-slate-900/90 text-slate-100 border-slate-700/80';

  return (
    <div className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-50 animate-toast-in pointer-events-none flex justify-center sm:justify-end">
      <div className={`flex items-center justify-center sm:justify-start gap-2.5 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md text-xs font-medium max-w-md w-full sm:w-auto text-center sm:text-left ${colorClass}`}>
        <Icon className="w-4 h-4 shrink-0" />
        <span className="break-words">{toastMessage.text}</span>
      </div>
    </div>
  );
};
