import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerStore {
  playerId: string | null;
  /** false до чтения localStorage — чтобы не мигал экран «выберите игрока» */
  hydrated: boolean;
  select: (playerId: string) => void;
  clear: () => void;
}

/**
 * Выбранный игрок — чисто клиентское состояние, поэтому Zustand, а не TanStack Query.
 * skipHydration: localStorage читается после гидрации (в Providers), иначе
 * разметка сервера (игрока нет) не совпала бы с первой отрисовкой клиента.
 */
export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      playerId: null,
      hydrated: false,
      select: (playerId) => set({ playerId }),
      clear: () => set({ playerId: null }),
    }),
    {
      name: '4cash:player',
      partialize: (s) => ({ playerId: s.playerId }),
      skipHydration: true,
      onRehydrateStorage: () => () => usePlayerStore.setState({ hydrated: true }),
    },
  ),
);
