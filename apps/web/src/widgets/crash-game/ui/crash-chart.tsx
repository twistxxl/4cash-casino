'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { useCrashStore, useLiveMultiplier } from '@/entities/crash';
import { CRASH_GROWTH } from '@/shared/config';
import { elapsedFor, formatMultiplier } from '@/shared/lib/crash';
import { cn } from '@/shared/lib/cn';

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const GRID_STEPS = [0.25, 0.5, 1, 2, 5, 10];

function BettingCountdown() {
  const t = useTranslations('crash');
  const endsAt = useCrashStore((s) => s.bettingEndsAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, (endsAt ?? now) - now);
  return (
    <div className="grid w-56 gap-2">
      <p className="text-sm font-semibold text-muted-foreground">{t('bettingIn', { seconds: (left / 1000).toFixed(1) })}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-primary transition-[width] duration-100" style={{ width: `${Math.min(100, (left / 7000) * 100)}%` }} />
      </div>
    </div>
  );
}

/** Кривая множителя. Сервер присылает только «старт» и «краш», всё между ними фронт рисует сам по той же формуле */
export function CrashChart({ className }: { className?: string }) {
  const t = useTranslations('crash');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const multRef = useRef<HTMLSpanElement>(null);
  const phase = useCrashStore((s) => s.phase);
  const { resolvedTheme } = useTheme();

  useLiveMultiplier(multRef, formatMultiplier);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const colors = { primary: token('--primary'), loss: token('--loss'), grid: token('--muted-foreground'), accent: token('--accent') };
    const monoFont = css.getPropertyValue('--font-rubik').trim() || 'sans-serif';

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let frame = 0;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const { phase: p, startedAt, crashPoint } = useCrashStore.getState();
      const crashed = p === 'crashed' && crashPoint !== null;
      const elapsed = p === 'running' && startedAt !== null ? Date.now() - startedAt : crashed ? elapsedFor(crashPoint) : 0;
      const m = crashed ? crashPoint : Math.exp(CRASH_GROWTH * elapsed);

      const pad = { l: 52, r: 20, t: 20, b: 28 };
      const maxT = Math.max(9_000, elapsed * 1.15);
      const maxM = Math.max(2, m * 1.2);
      const x = (tt: number) => pad.l + (tt / maxT) * (w - pad.l - pad.r);
      const y = (mm: number) => h - pad.b - ((mm - 1) / (maxM - 1)) * (h - pad.b - pad.t);

      // сетка по множителю
      const step = GRID_STEPS.find((s) => (maxM - 1) / s <= 5) ?? 20;
      ctx.font = `11px ${monoFont}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = 1; v <= maxM + 1e-9; v += step) {
        const yy = Math.round(y(v)) + 0.5;
        ctx.strokeStyle = withAlpha(colors.grid, 0.15);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(pad.l, yy);
        ctx.lineTo(w - pad.r, yy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = withAlpha(colors.grid, 0.75);
        ctx.fillText(`${v.toFixed(v % 1 ? 2 : 1)}×`, pad.l - 8, yy);
      }

      if (elapsed > 0) {
        const line = crashed ? colors.loss : colors.primary;
        const points: Array<[number, number]> = [];
        const N = 100;
        for (let i = 0; i <= N; i++) {
          const tt = (elapsed * i) / N;
          points.push([x(tt), y(Math.min(Math.exp(CRASH_GROWTH * tt), m))]);
        }

        // заливка под кривой
        const fill = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
        fill.addColorStop(0, withAlpha(line, 0.35));
        fill.addColorStop(1, withAlpha(line, 0));
        ctx.beginPath();
        ctx.moveTo(points[0][0], h - pad.b);
        points.forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.lineTo(points[N][0], h - pad.b);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();

        // сама кривая
        ctx.beginPath();
        points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.strokeStyle = line;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = withAlpha(line, 0.6);
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // «ракета» на конце
        const [ex, ey] = points[N];
        ctx.beginPath();
        ctx.arc(ex, ey, 7, 0, Math.PI * 2);
        ctx.fillStyle = crashed ? colors.loss : colors.accent;
        ctx.shadowColor = withAlpha(crashed ? colors.loss : colors.accent, 0.9);
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [resolvedTheme]);

  return (
    <div className={cn('relative', className)}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
      <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 text-center" aria-live="polite">
        <div className="grid justify-items-center gap-3">
          <span
            ref={multRef}
            className={cn(
              'font-display text-6xl font-bold tabular-nums drop-shadow-sm sm:text-7xl',
              phase === 'crashed' ? 'text-loss' : phase === 'running' ? 'text-foreground' : 'text-foreground/30',
            )}
          >
            1.00×
          </span>
          {phase === 'betting' && <BettingCountdown />}
          {phase === 'crashed' && <p className="font-semibold text-loss">{t('crashed')}</p>}
          {phase === 'idle' && <p className="text-sm text-muted-foreground">{t('idle')}</p>}
        </div>
      </div>
    </div>
  );
}
