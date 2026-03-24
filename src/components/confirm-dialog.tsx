"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";

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

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => handleClose(false)} />
          <div className="fixed left-1/2 top-1/2 z-[61] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-6 shadow-xl">
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
