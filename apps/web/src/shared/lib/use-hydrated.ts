'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** true только на клиенте после гидрации — для того, что зависит от localStorage */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
