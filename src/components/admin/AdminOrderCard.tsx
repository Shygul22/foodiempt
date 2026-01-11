
import { useState } from 'react';
import { Order, OrderStatus, DeliveryPartner } from '@/types/database';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Store,
    Phone,
    Bike,
    ChevronDown,
    ChevronUp,
    X
} from 'lucide-react';
import { format } from 'date-fns';

interface OrderWithDetails extends Order {
    restaurants: { name: string; address: string; phone: string | null } | null;
    customer_profile?: { full_name: string | null; phone: string | null } | null;
    order_items: {
        quantity: number;
        menu_item_id: string;
        menu_items: { name: string; price: number } | null;
    }[];
}

interface DeliveryPartnerWithProfile extends DeliveryPartner {
    profiles?: {
        full_name: string | null;
        phone: string | null;
    };
}

interface AdminOrderCardProps {
    order: OrderWithDetails;
    deliveryPartners: DeliveryPartnerWithProfile[];
    onCancel: (orderId: string) => void;
}

export function AdminOrderCard({ order, deliveryPartners, onCancel }: AdminOrderCardProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Calculate subtotal (Item Total)
    const itemTotal = order.order_items.reduce((sum, item) => {
        const price = item.menu_items?.price || 0;
        return sum + (price * item.quantity);
    }, 0);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="rounded-xl border border-border bg-card hover:bg-secondary/10 transition-all"
        >
            {/* Header - Always Visible */}
            <div className="p-4 flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-medium">#{order.id.slice(0, 8)}</span>
                        <StatusBadge status={order.status as OrderStatus} />
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-6 h-6 p-0 hover:bg-transparent">
                                {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</span>
                        <span>•</span>
                        <span className="font-medium text-foreground">{order.restaurants?.name || 'Unknown Shop'}</span>
                        {order.delivery_partner_id && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-accent">
                                    <Bike className="w-3 h-3" />
                                    {(() => {
                                        const partner = deliveryPartners.find(p => p.id === order.delivery_partner_id);
                                        if (partner?.profiles?.full_name) return partner.profiles.full_name;
                                        if (partner) return 'Unknown Name';
                                        return `Partner #${order.delivery_partner_id.slice(0, 4)}`;
                                    })()}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="text-right">
                    <p className="font-bold text-lg text-primary">₹{Number(order.total_amount).toFixed(0)}</p>
                    {!['delivered', 'cancelled'].includes(order.status) && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive mt-1 px-0">
                                    Cancel Order
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to cancel this order? This cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Keep</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => onCancel(order.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Cancel Order
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            <CollapsibleContent>
                <div className="px-4 pb-4 pt-0">
                    <div className="h-px bg-border/50 mb-4" />
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        {/* Left Column: Shop, Customer & Items */}
                        <div className="space-y-3">
                            {/* Shop Details */}
                            <div className="p-3 bg-secondary/20 rounded-lg space-y-1">
                                <div className="flex items-center gap-2 font-medium">
                                    <Store className="w-4 h-4 text-primary" />
                                    Shop Details
                                </div>
                                <p className="text-xs font-medium pl-6">{order.restaurants?.name}</p>
                                <p className="text-xs text-muted-foreground pl-6 truncate">{order.restaurants?.address}</p>
                                {order.restaurants?.phone && (
                                    <p className="text-xs text-muted-foreground pl-6 flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> {order.restaurants.phone}
                                    </p>
                                )}
                            </div>

                            {/* Customer Details */}
                            <div className="p-3 bg-accent/10 rounded-lg space-y-1">
                                <div className="flex items-center gap-2 font-medium">
                                    <div className="w-4 h-4 flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px]">C</div>
                                    Customer Details
                                </div>
                                <p className="text-xs font-medium pl-6">{order.customer_profile?.full_name || 'Guest User'}</p>
                                {order.customer_profile?.phone && (
                                    <p className="text-xs text-muted-foreground pl-6 flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> {order.customer_profile.phone}
                                    </p>
                                )}
                            </div>

                            {/* Items */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Items</p>
                                <div className="space-y-1.5 pl-2 border-l-2 border-primary/20">
                                    {order.order_items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span>
                                                <span className="font-medium text-foreground">{item.quantity}x</span>{' '}
                                                <span className="text-muted-foreground">{item.menu_items?.name || 'Unknown Item'}</span>
                                            </span>
                                            {item.menu_items?.price && (
                                                <span className="text-xs text-muted-foreground">
                                                    ₹{item.menu_items.price * item.quantity}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Delivery & Pricing */}
                        <div className="space-y-3">
                            {/* Delivery Partner Info */}
                            {order.delivery_partner_id ? (
                                <div className="p-3 bg-secondary/20 rounded-lg space-y-1">
                                    <div className="flex items-center gap-2 font-medium">
                                        <Bike className="w-4 h-4 text-accent" />
                                        Delivery Partner
                                    </div>
                                    {(() => {
                                        const partner = deliveryPartners.find(p => p.id === order.delivery_partner_id);
                                        return partner ? (
                                            <>
                                                <p className="text-sm pl-6">{partner.profiles?.full_name || 'Unknown Name'}</p>
                                                <p className="text-xs text-muted-foreground pl-6 flex items-center gap-1">
                                                    <Phone className="w-3 h-3" /> {partner.profiles?.phone || partner.phone || 'No Phone'}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-muted-foreground pl-6">ID: {order.delivery_partner_id.slice(0, 8)}...</p>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-2 text-muted-foreground text-sm">
                                    <Bike className="w-4 h-4 opacity-50" />
                                    No Partner Assigned
                                </div>
                            )}

                            {/* Price Breakdown */}
                            <div className="p-3 border rounded-lg space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Item Total</span>
                                    <span>₹{itemTotal || '0'}</span> {/* Fallback if no item prices */}
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Delivery Fee</span>
                                    <span>₹{order.delivery_fee || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Platform Fee</span>
                                    <span>₹8</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t font-semibold text-sm">
                                    <span>Total</span>
                                    <span className="text-primary">₹{Number(order.total_amount).toFixed(0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
