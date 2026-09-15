import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  title = 'Confirm Deletion',
  message,
  itemCount,
  itemCountLabel = 'leads',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDeleting = false,
  onConfirm,
  onClose
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Modal Card */}
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full overflow-hidden transform transition-all animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-3 space-y-3">
          <h3 className="text-base font-bold text-gray-900 leading-tight">
            {title}
          </h3>

          <p className="text-xs text-gray-600 leading-relaxed">
            {message}
          </p>

          {/* Lead count warning banner if applicable */}
          {typeof itemCount === 'number' && (
            <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <span className="font-semibold block">Important:</span>
                <span>This campaign contains <strong className="font-bold text-rose-700">{itemCount} {itemCountLabel}</strong>. Deleting it will remove this entire pipeline.</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 transition cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm shadow-rose-600/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
