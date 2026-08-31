import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className = '', ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={`peer h-4 w-4 shrink-0 rounded border border-zinc-700 bg-zinc-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:text-white transition-colors ${className}`}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className="flex items-center justify-center text-current"
    >
      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

interface CheckboxFieldProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function CheckboxField({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  badge,
  className = '',
}: CheckboxFieldProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className={`flex items-start gap-3 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <Checkbox
        id={inputId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <label
          htmlFor={inputId}
          className={`flex items-center gap-2 text-xs font-medium text-zinc-200 cursor-pointer ${disabled ? 'cursor-not-allowed' : ''}`}
        >
          <span>{label}</span>
          {badge}
        </label>
        {description && (
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export { Checkbox };
