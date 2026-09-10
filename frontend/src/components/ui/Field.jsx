import React from 'react';

/**
 * Clean Form Field Container with Label, Validation, and Hint
 */
export default function Field({
  label,
  error,
  hint,
  required = false,
  children,
  className = '',
  id,
}) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-medium text-[var(--text-3)] tracking-wide flex items-center gap-1 select-none"
        >
          <span>{label}</span>
          {required && <span className="text-[var(--bad)]">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p className="text-[11px] text-[var(--bad)] font-medium mt-0.5 leading-tight animate-drop-in">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[var(--text-3)] mt-0.5 leading-tight">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  className = '',
  isNumeric = false,
  isValue = false,
  ...props
}) {
  const fontClass = isValue ? 'val' : isNumeric ? 'num' : '';
  const errorBorder = error ? 'border-[var(--bad)] focus:border-[var(--bad)]' : '';

  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`field w-full h-8 px-2.5 text-[13px] ${fontClass} ${errorBorder} ${className}`}
      {...props}
    />
  );
}
