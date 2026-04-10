'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-wise-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full px-3 py-2.5 border rounded-lg text-sm text-wise-gray-700 placeholder-wise-gray-400 focus:outline-none focus:ring-2 focus:ring-wise-green focus:border-wise-green transition-colors ${
            error ? 'border-red-500' : 'border-wise-gray-200'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
