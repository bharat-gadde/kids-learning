// src/app/ui/hooks.ts
import { useCallback, useEffect, useRef, useState } from 'react';

/** The window's size, kept current: mechanics size their pictures from it. */
export function useViewport(): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/** setTimeout that is cleared when the component goes away (the child can leave mid-round). */
export function useLater(): (fn: () => void, ms: number) => void {
  const ids = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => ids.current.forEach((id) => clearTimeout(id)), []);
  return useCallback((fn: () => void, ms: number) => {
    ids.current.push(setTimeout(fn, ms));
  }, []);
}
