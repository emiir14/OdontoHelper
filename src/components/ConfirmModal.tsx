import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirm } = useAppStore();

  if (!confirmDialog) return null;

  const {
    title,
    description,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = true,
    onConfirm,
  } = confirmDialog;

  const handleConfirm = () => {
    onConfirm();
    closeConfirm();
  };

  return (
    <Modal
      onClose={closeConfirm}
      size="md"
      zIndexClass="z-[60]"
      title={title}
      icon={
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDestructive
              ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-900/60 text-rose-600 dark:text-rose-400'
              : 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-900/60 text-amber-600 dark:text-amber-400'
          }`}
        >
          {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={closeConfirm}>
            {cancelText}
          </Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </Modal>
  );
};
