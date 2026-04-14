import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging tailwind classes safely
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Icon wrapper to comply with design governance rules.
 * Ensures consistent styling and type safety.
 */
export type IconProps = {
  className?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
};

export type StyledIcon = React.FC<IconProps>;

export const wrapIcon = (IconComponent: any): StyledIcon => {
  return ({ className, size = 20, strokeWidth = 2, ...props }: IconProps) => (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={cn("text-foreground/70 transition-colors duration-200", className)}
      {...props}
    />
  );
};
