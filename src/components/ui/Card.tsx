import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  selected?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover = false, selected = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white rounded-xl border shadow-sm p-5 ${
          hover ? 'hover:shadow-md hover:border-wise-green cursor-pointer transition-all' : ''
        } ${selected ? 'border-wise-green ring-2 ring-wise-green/20' : 'border-wise-gray-200'} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
