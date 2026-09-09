import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Composable Button Primitive supporting variants:
 * - primary: high-contrast accent button
 * - secondary: subtle well background with border
 * - ghost: transparent button for icon controls
 * - danger: destructive action button
 * - liquid: liquid glass button with refraction and soft glow
 */
export default function Button({
  children,
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const sizeClasses = {
    sm: 'h-7 px-2.5 text-[12px] gap-1.5',
    md: 'h-8 sm:h-9 px-3.5 text-[13px] gap-2',
    lg: 'h-10 px-5 text-[14px] gap-2.5',
  }[size] || 'h-9 px-3.5 text-[13px] gap-2';

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn',
    ghost: 'btn-ghost',
    danger: 'bg-[var(--color-bad-soft,#fb718520)] text-[var(--color-bad,#fb7185)] border border-[var(--color-bad,#fb7185)]/30 hover:bg-[var(--color-bad,#fb7185)] hover:text-white transition-colors',
    liquid: 'glass-liquid text-[var(--color-text-primary)] hover:border-[var(--color-accent)] font-medium',
  }[variant] || 'btn';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] cursor-pointer select-none transition-all duration-[var(--dur-1)] ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}
