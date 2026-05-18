import React, { createContext, useCallback, useContext, useState } from "react";

export type ToastType = "success" | "error" | "info";
interface ToastItem { id: number; msg: string; type: ToastType; }

const Ctx = createContext<((msg: string, type?: ToastType) => void) | null>(null);
let _uid = 0;

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((msg: string, type: ToastType = "success") => {
    const id = ++_uid;
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "i"}
            </span>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): (msg: string, type?: ToastType) => void {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast outside ToastProvider");
  return v;
}
