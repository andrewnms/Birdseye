import { useCallback, useRef, useState } from "react";

import {
  createCachedCraneDemo,
  type CachedCraneDemo,
  type CachedCraneDemoSnapshot,
} from "../lib/cached-crane-demo";

export type CachedCraneDemoState = CachedCraneDemoSnapshot & {
  advance(): void;
};

export function useCachedCraneDemo(): CachedCraneDemoState {
  const demoRef = useRef<CachedCraneDemo | null>(null);

  if (demoRef.current === null) {
    demoRef.current = createCachedCraneDemo();
  }

  const [snapshot, setSnapshot] = useState<CachedCraneDemoSnapshot>(() =>
    demoRef.current!.snapshot(),
  );

  const advance = useCallback(() => {
    setSnapshot(demoRef.current!.advance());
  }, []);

  return { ...snapshot, advance };
}
