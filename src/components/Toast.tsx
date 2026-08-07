export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-20 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div className="bg-header text-white px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg">
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
