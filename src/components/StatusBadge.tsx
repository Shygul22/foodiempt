import * as React from 'react';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types/database';

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-status-pending/10 text-status-pending border-status-pending/30' },
  confirmed: { label: 'Confirmed', className: 'bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30' },
  preparing: { label: 'Preparing', className: 'bg-status-preparing/10 text-status-preparing border-status-preparing/30' },
  ready_for_pickup: { label: 'Ready', className: 'bg-status-ready/10 text-status-ready border-status-ready/30' },
  picked_up: { label: 'Picked Up', className: 'bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30' },
  on_the_way: { label: 'On the Way', className: 'bg-status-preparing/10 text-status-preparing border-status-preparing/30' },
  delivered: { label: 'Delivered', className: 'bg-status-delivered/10 text-status-delivered border-status-delivered/30' },
  cancelled: { label: 'Cancelled', className: 'bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30' },
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: OrderStatus;
}

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status || 'Unknown', className: 'bg-muted text-muted-foreground border-border' };
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
      {...props}
    >
      {config.label}
    </span>
  );
}

export { StatusBadge };
