"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: () => Promise.resolve(false),
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  // Animate in when state is set
  useEffect(() => {
    if (state) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    }
  }, [state]);

  const handleClose = (result: boolean) => {
    if (!visible) return;
    setVisible(false);
    timeoutRef.current = setTimeout(() => {
      state?.resolve(result);
      setState(null);
    }, 150);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <>
          <div
            className={cn(
              "fixed inset-0 z-[60]",
              "bg-black/50",
              visible ? "backdrop-active" : "backdrop-enter"
            )}
            onClick={() => handleClose(false)}
          />
          <div
            className={cn(
              "fixed left-1/2 top-1/2 z-[61] w-full max-w-sm rounded-lg border bg-white p-6 shadow-xl",
              visible ? "dialog-active" : "dialog-enter"
            )}
          >
            <h3 className="font-medium text-sm mb-1">{state.options.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{state.options.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                {state.options.cancelLabel || "Cancel"}
              </Button>
              <Button
                size="sm"
                variant={state.options.variant === "danger" ? "destructive" : "default"}
                onClick={() => handleClose(true)}
              >
                {state.options.confirmLabel || "Confirm"}
              </Button>
            </div>
          </div>
        </>
      )}
    </ConfirmContext.Provider>
  );
}
