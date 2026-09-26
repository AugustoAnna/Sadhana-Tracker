import { type ReactNode, useEffect } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  hideCloseButton?: boolean;
  dismissOnBackdrop?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  hideCloseButton = false,
  dismissOnBackdrop = true,
}: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {dismissOnBackdrop && (
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      )}
      {!dismissOnBackdrop && <div className="absolute inset-0 bg-black/50" />}
      <div className="relative w-full bg-raised rounded-t-[18px] px-4 pt-4 pb-8 safe-bottom max-h-[85vh] overflow-y-auto">
        <div className={`flex items-center justify-between mb-4 ${hideCloseButton ? '' : 'pr-8'}`}>
          {title && <h2 className="font-serif text-headline flex-1 text-center">{title}</h2>}
          {!hideCloseButton && (
            <button onClick={onClose} className="absolute right-4 top-4 w-11 h-11 flex items-center justify-center" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
