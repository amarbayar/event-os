import { useState, useEffect, useRef } from "react";

/**
 * Hook for mount/unmount animations.
 * Returns `mounted` (DOM present) and `visible` (animation active).
 * Uses double rAF to ensure the browser paints the initial state before transitioning.
 */
export function useAnimatedMount(isOpen: boolean, exitDuration = 150) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), exitDuration);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [isOpen, exitDuration]);

  return { mounted, visible };
}
