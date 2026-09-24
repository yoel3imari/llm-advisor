import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-zinc-100 text-zinc-900',
        secondary: 'border-transparent bg-zinc-800 text-zinc-200',
        outline: 'border-zinc-700 text-zinc-300',
        success: 'border-transparent bg-green-900 text-green-100',
        warning: 'border-transparent bg-amber-900 text-amber-100',
        destructive: 'border-transparent bg-red-900 text-red-100',
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
