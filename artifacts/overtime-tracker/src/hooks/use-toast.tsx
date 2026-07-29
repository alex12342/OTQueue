import React, { createContext, useState, useCallback, useRef } from "react";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
}

interface ToasterContextValue {
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const ToasterContext = createContext<ToasterContextValue>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  console.log('[ToasterProvider] mount');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const toast = useCallback((toast: Omit<Toast, "id">) => {
    console.log('[ToasterProvider] toast called:', toast);
    const id = Math.random().toString(36).slice(2, 10);
    setToasts((prev) => {
      const next = [...prev, { ...toast, id }];
      console.log('[ToasterProvider] setToasts:', prev.length, '->', next.length);
      return next;
    });

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, 5000);
    timersRef.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  return (
    <ToasterContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToasterContext.Provider>
  );
}

export function Toaster() {
  const { toasts, dismiss } = React.useContext(ToasterContext);
  console.log('[Toaster] toasts:', toasts.length, toasts);

  return (
    <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-4 w-full max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg border shadow-lg p-4 bg-background text-foreground transition-all ${
            toast.variant === "destructive"
              ? "border-destructive/50 text-destructive"
              : ""
          }`}
        >
          {toast.title && (
            <div className="font-semibold text-sm">{toast.title}</div>
          )}
          {toast.description && (
            <div className="text-sm text-muted-foreground mt-1">
              {toast.description}
            </div>
          )}
          <button
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            onClick={() => dismiss(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = React.useContext(ToasterContext);
  if (!context) {
    throw new Error("useToast must be used within a ToasterProvider");
  }
  return context;
}
