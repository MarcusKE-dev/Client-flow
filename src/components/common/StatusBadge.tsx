import React from 'react';

export type BadgeStatusType = 
  | 'active' 
  | 'prospect' 
  | 'overdue' 
  | 'follow-up' 
  | 'inactive' 
  | 'needs_attention' 
  | 'completed'
  | string;

interface StatusBadgeProps {
  status: BadgeStatusType;
  label?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

export const getStatusTextColor = (status: BadgeStatusType): string => {
  const s = status.toLowerCase();
  switch (s) {
    case 'active':
      return 'text-emerald-700';
    case 'prospect':
      return 'text-blue-700';
    case 'overdue':
    case 'action overdue':
      return 'text-red-700';
    case 'follow-up':
    case 'follow up':
    case 'followup':
      return 'text-amber-800';
    case 'needs_attention':
    case 'needs attention':
    case 'cadence due':
      return 'text-amber-800';
    case 'completed':
      return 'text-emerald-700';
    case 'inactive':
    default:
      return 'text-gray-600';
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'xs',
  className = ''
}) => {
  const textColor = getStatusTextColor(status);
  const sizeClass = size === 'sm' ? 'text-xs' : 'text-[10px]';
  const displayLabel = label || status;

  return (
    <span className={`${sizeClass} font-semibold uppercase tracking-wider ${textColor} ${className}`.trim()}>
      {displayLabel}
    </span>
  );
};
