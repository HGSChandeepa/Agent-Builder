"use client";

interface SlateToastProps {
  readonly message: string | null;
}

export function SlateToast({ message }: SlateToastProps) {
  if (!message) {
    return null;
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="rounded-lg border border-slate-700/60 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-lg">
        {message}
      </div>
    </div>
  );
}
