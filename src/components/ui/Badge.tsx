import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-indigo-200/70 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/80 dark:text-indigo-300',
        secondary: 'border-slate-200 dark:border-slate-750 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        outline: 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-transparent',
        success: 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/80 dark:text-emerald-300',
        warning: 'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-300',
        destructive: 'border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/80 dark:text-rose-300',
        brand: 'border-transparent bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
