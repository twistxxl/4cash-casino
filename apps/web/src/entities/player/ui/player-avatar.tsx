import { cn } from '@/shared/lib/cn';

const HUES = [200, 188, 212, 172, 226, 160, 240, 196];

/** Аватар из инициалов; цвет стабилен для одного и того же имени */
export function PlayerAvatar({ username, className }: { username: string; className?: string }) {
  const hash = [...username].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const hue = HUES[hash % HUES.length];
  const initials = username.replace(/^demo_/, '').slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        'inline-grid size-9 shrink-0 place-items-center rounded-xl font-display text-xs font-bold text-white shadow-sm',
        className,
      )}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${hue + 20} 80% 45%))` }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
