import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-corporate-btn hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        secondary:
          'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:border-slate-300 hover:text-slate-900 dark:hover:text-white hover:-translate-y-0.5 active:translate-y-0',
        outline:
          'border border-slate-200 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:border-slate-300',
        ghost:
          'text-slate-600 dark:text-slate-400 hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 hover:text-indigo-600 dark:hover:text-indigo-400',
        destructive:
          'bg-rose-600 text-white shadow-sm hover:bg-rose-500 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        brand:
          'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-corporate-btn hover:from-indigo-500 hover:to-violet-500 hover:-translate-y-0.5 active:translate-y-0',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-lg px-6 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
