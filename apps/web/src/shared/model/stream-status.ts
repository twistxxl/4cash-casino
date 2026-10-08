import { create } from 'zustand';
import type { StreamStatus } from '@/shared/api';

/** Состояние SSE-соединения с gateway — показывается индикатором в шапке */
export const useStreamStatus = create<{ status: StreamStatus; set: (status: StreamStatus) => void }>((set) => ({
  status: 'connecting',
  set: (status) => set({ status }),
}));
