import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-b from-primary to-[color-mix(in_oklab,var(--primary),black_12%)] text-primary-foreground shadow-[0_8px_24px_-10px_var(--primary)] hover:brightness-110 active:scale-[0.98]',
        glass: 'glass text-foreground hover:bg-[var(--glass-strong)] active:scale-[0.98]',
        ghost: 'text-foreground hover:bg-foreground/[0.06]',
        outline: 'border border-border bg-transparent text-foreground hover:bg-foreground/[0.05]',
        win: 'bg-win text-white shadow-[0_8px_24px_-10px_var(--win)] hover:brightness-110 active:scale-[0.98]',
        loss: 'bg-loss text-white shadow-[0_8px_24px_-10px_var(--loss)] hover:brightness-110 active:scale-[0.98]',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
