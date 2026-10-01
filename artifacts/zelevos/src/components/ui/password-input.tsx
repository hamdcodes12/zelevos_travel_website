import * as React from 'react';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, style, wrapperClassName, wrapperStyle, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div
        className={cn('relative flex items-center w-full', wrapperClassName)}
        style={{ position: 'relative', width: '100%', ...wrapperStyle }}
      >
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          style={{
            paddingRight: '40px',
            boxSizing: 'border-box',
            ...style,
          }}
          {...props}
        />
        <button
          type="button"
          tabIndex={0}
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            setShowPassword((prev) => !prev);
          }}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            padding: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: disabled ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            lineHeight: 1,
            zIndex: 2,
          }}
          className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {showPassword ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
