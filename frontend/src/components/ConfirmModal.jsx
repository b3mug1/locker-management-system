import React, { useEffect, useRef } from 'react';
import { animateModalOpen } from '../utils/animations';

function ConfirmModal({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  const modalRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
      document.body.style.overflow = 'hidden';
      animateModalOpen(modalRef.current, overlayRef.current);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" ref={overlayRef} onClick={onCancel}>
      <div className="confirm-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon confirm-icon-${variant}`}>
          {variant === 'danger' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-outline confirm-cancel-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn confirm-confirm-btn ${variant === 'danger' ? 'btn-danger' : 'btn-warning'}`}
            onClick={onConfirm}
            ref={confirmRef}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
