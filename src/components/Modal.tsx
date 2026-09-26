interface ModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  dark?: boolean;
}

export function Modal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  dark = false,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className={`relative rounded-2xl p-6 w-full max-w-sm ${dark ? 'bg-[#2A2418] text-white' : 'bg-raised'}`}>
        <h2 className="font-serif text-xl font-semibold mb-2">{title}</h2>
        <p className={`mb-6 text-sm ${dark ? 'text-white/80' : 'text-secondary'}`}>{message}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className={`w-full py-3 rounded-xl font-semibold border-2 ${
              dark
                ? 'border-white/40 text-white bg-white/10'
                : 'border-border text-ink bg-page'
            }`}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
