import { useState, useEffect, useRef } from "react";

/**
 * Hook for mount/unmount animations.
 * Returns `mounted` (DOM present) and `visible` (animation active).
 * Uses double rAF to ensure the browser paints the initial state before transitioning.
 */
export function useAnimatedMount(isOpen: boolean, exitDuration = 150) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const mountFrameRef = useRef<number | null>(null);
  const visibleFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (mountFrameRef.current !== null) {
      cancelAnimationFrame(mountFrameRef.current);
    }
    if (visibleFrameRef.current !== null) {
      cancelAnimationFrame(visibleFrameRef.current);
    }
    clearTimeout(timeoutRef.current);

    if (isOpen) {
      mountFrameRef.current = requestAnimationFrame(() => {
        setMounted(true);
        visibleFrameRef.current = requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      visibleFrameRef.current = requestAnimationFrame(() => {
        setVisible(false);
      });
      timeoutRef.current = setTimeout(() => setMounted(false), exitDuration);
    }
    return () => {
      if (mountFrameRef.current !== null) {
        cancelAnimationFrame(mountFrameRef.current);
      }
      if (visibleFrameRef.current !== null) {
        cancelAnimationFrame(visibleFrameRef.current);
      }
      clearTimeout(timeoutRef.current);
    };
  }, [isOpen, exitDuration]);

  return { mounted, visible };
}
