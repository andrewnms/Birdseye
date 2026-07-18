import { useCallback, useState } from "react";

import {
  createCachedCraneDemo,
  type CachedCraneDemo,
  type CachedCraneDemoSnapshot,
} from "../lib/cached-crane-demo";

export type CachedCraneDemoState = CachedCraneDemoSnapshot & {
  advance(): void;
};

export function useCachedCraneDemo(): CachedCraneDemoState {
  const [demo] = useState<CachedCraneDemo>(() => createCachedCraneDemo());
  const [snapshot, setSnapshot] = useState<CachedCraneDemoSnapshot>(() =>
    demo.snapshot(),
  );

  const advance = useCallback(() => {
    setSnapshot(demo.advance());
  }, [demo]);

  return { ...snapshot, advance };
}
