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
          hover ? 'hover:shadow-md hover:border-imb-green cursor-pointer transition-all' : ''
        } ${selected ? 'border-imb-green ring-2 ring-imb-lime/40' : 'border-imb-gray-200'} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
