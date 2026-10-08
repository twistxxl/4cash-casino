'use client';

import { useEffect, type RefObject } from 'react';
import { multiplierAt } from '@/shared/lib/crash';
import { useCrashStore } from '../model/store';

/**
 * Пишет текущий множитель прямо в DOM-узел каждый кадр (requestAnimationFrame),
 * минуя React: 60 перерисовок компонента в секунду ради одного числа не нужны.
 */
export function useLiveMultiplier(ref: RefObject<HTMLElement | null>, format: (m: number) => string) {
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const { phase, startedAt, crashPoint } = useCrashStore.getState();
      const m =
        phase === 'running' && startedAt !== null
          ? multiplierAt(Date.now() - startedAt)
          : phase === 'crashed' && crashPoint !== null
            ? crashPoint
            : 1;
      if (ref.current) ref.current.textContent = format(m);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, format]);
}
