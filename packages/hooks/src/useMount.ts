import { useEffect, useRef } from 'react';

type Fn = () => void | (() => void);

export function useMount(fn: Fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    return fnRef.current?.();
  }, []);
}
