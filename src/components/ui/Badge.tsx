import React from 'react';
import { badgeClass, BadgeSize, BadgeTone } from './uiClasses';

export interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  size = 'sm',
  className,
  title,
  children,
}) => (
  <span className={badgeClass({ tone, size, className })} title={title}>
    {children}
  </span>
);
