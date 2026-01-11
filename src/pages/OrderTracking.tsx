import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { GlobalLoading } from '@/components/ui/GlobalLoading';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus, DeliveryPartner } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ReviewForm } from '@/components/ReviewForm';
import {
  ArrowLeft,
  Package,
  Clock,
  MapPin,
  Phone,
  Key,
  Navigation,
  Bike,
  Store,
  Home,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useCustomerOrderNotifications } from '@/hooks/useOrderNotifications';

interface OrderWithDetails extends Order {
  restaurants: {
    name: string;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    address: string;
  } | null;
}

interface DeliveryPartnerWithProfile extends DeliveryPartner {
  profiles?: { full_name: string | null; phone: string | null } | null;
}

const orderSteps: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending', label: 'Order Placed', icon: <Package className="w-4 h-4" /> },
  { status: 'confirmed', label: 'Confirmed', icon: <CheckCircle2 className="w-4 h-4" /> },
  { status: 'preparing', label: 'Preparing', icon: <Store className="w-4 h-4" /> },
  { status: 'ready_for_pickup', label: 'Ready', icon: <Package className="w-4 h-4" /> },
  { status: 'picked_up', label: 'Picked Up', icon: <Bike className="w-4 h-4" /> },
  { status: 'on_the_way', label: 'On the Way', icon: <Navigation className="w-4 h-4" /> },
  { status: 'delivered', label: 'Delivered', icon: <Home className="w-4 h-4" /> },
];

const getStepIndex = (status: OrderStatus) => {
  if (status === 'cancelled') return -1;
  return orderSteps.findIndex(s => s.status === status);
};

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPartnerWithProfile | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [loading, setLoading] = useState(true);



  // Sound notifications for order status changes
  useCustomerOrderNotifications(orderId);

  const fetchOrder = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, restaurants(name, phone, lat, lng, address)')
      .eq('id', orderId!)
      .eq('customer_id', user!.id)
      .single();

    if (error || !data) {
      toast.error('Order not found');
      navigate('/orders');
      return;
    }

    setOrder(data);

    // Check if user has already reviewed this order
    const { data: reviewData } = await supabase
      .from('restaurant_reviews')
      .select('id')
      .eq('order_id', orderId!)
      .maybeSingle();

    setHasReviewed(!!reviewData);

    // Fetch delivery partner if assigned
    if (data.delivery_partner_id) {
      const { data: partnerData } = await supabase
        .from('delivery_partners')
        .select('*')
        .eq('id', data.delivery_partner_id)
        .single();

      if (partnerData) {
        setDeliveryPartner(partnerData);
      }
    }

    setLoading(false);
  }, [orderId, user, navigate]);

  const subscribeToUpdates = useCallback(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          fetchOrder();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_partners',
        },
        () => {
          if (order?.delivery_partner_id) {
            fetchOrder();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchOrder, order?.delivery_partner_id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user && orderId) {
      fetchOrder();
      const cleanup = subscribeToUpdates();
      return cleanup;
    }
  }, [user, authLoading, orderId, navigate, fetchOrder, subscribeToUpdates]);

  if (authLoading || loading) {
    return <GlobalLoading message="Loading orders..." />;
  }

  if (!order) {
    return null;
  }

  const currentStep = getStepIndex(order.status as OrderStatus);
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const isActive = !isCancelled && !isDelivered;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/orders" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Track Order</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Order Header */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg">{order.restaurants?.name}</h2>
                <p className="text-sm text-muted-foreground font-mono">
                  #{order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <StatusBadge status={order.status as OrderStatus} />
            </div>
          </div>

          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Ordered: {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
            {order.is_scheduled && order.scheduled_at && (
              <div className="flex items-center gap-2 text-sm text-primary mt-2">
                <Clock className="w-4 h-4" />
                <span>Scheduled for: {format(new Date(order.scheduled_at), 'MMM d, h:mm a')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Tracking Progress */}
        {isActive && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">Order Status</h3>
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />
                <div
                  className="absolute left-[19px] top-0 w-0.5 bg-primary transition-all duration-500"
                  style={{ height: `${(currentStep / (orderSteps.length - 1)) * 100}%` }}
                />

                <div className="space-y-4">
                  {orderSteps.map((step, index) => {
                    const isCompleted = index <= currentStep;
                    const isCurrent = index === currentStep;

                    return (
                      <div key={step.status} className="flex items-center gap-4 relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all ${isCompleted
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                          } ${isCurrent ? 'ring-4 ring-primary/20 animate-pulse-soft' : ''}`}>
                          {step.icon}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </p>
                          {isCurrent && (
                            <p className="text-sm text-primary animate-fade-in">In progress...</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Partner Info */}
        {deliveryPartner && isActive && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Delivery Partner</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bike className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Delivery Partner</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {deliveryPartner.vehicle_type || 'Bike'}
                    </p>
                  </div>
                </div>
                {deliveryPartner.phone && (
                  <a href={`tel:${deliveryPartner.phone}`}>
                    <Button size="icon" variant="outline" className="rounded-full">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </a>
                )}
              </div>

              {/* Partner Location */}
              {deliveryPartner.current_lat && deliveryPartner.current_lng && (
                <div className="mt-4 p-3 bg-accent/10 rounded-lg">
                  <div className="flex items-center gap-2 text-accent">
                    <Navigation className="w-4 h-4" />
                    <span className="text-sm font-medium">Partner is nearby</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Location: {deliveryPartner.current_lat.toFixed(4)}, {deliveryPartner.current_lng.toFixed(4)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery OTP */}
        {order.delivery_otp && isActive && (
          <Card className="border-0 shadow-sm border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Delivery OTP</p>
                  <p className="font-mono font-bold text-2xl text-primary tracking-[0.5em]">
                    {order.delivery_otp}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Share this code with your delivery partner to confirm delivery
              </p>
            </CardContent>
          </Card>
        )}

        {/* Addresses */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Shop Address */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Pickup from</p>
                <p className="font-medium">{order.restaurants?.name}</p>
                <p className="text-sm text-muted-foreground">{order.restaurants?.address}</p>
              </div>
              {order.restaurants?.phone && (
                <a href={`tel:${order.restaurants.phone}`}>
                  <Button size="icon" variant="ghost" className="shrink-0">
                    <Phone className="w-4 h-4" />
                  </Button>
                </a>
              )}
            </div>

            <div className="border-l-2 border-dashed border-border ml-4 h-4" />

            {/* Delivery Address */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Deliver to</p>
                <p className="font-medium">{order.delivery_address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Total */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold text-xl text-primary">
                ₹{Number(order.total_amount).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cancelled State */}
        {isCancelled && (
          <Card className="border-0 shadow-sm border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 text-center">
              <p className="text-destructive font-medium">This order has been cancelled</p>
            </CardContent>
          </Card>
        )}

        {/* Delivered State */}
        {isDelivered && (
          <>
            <Card className="border-0 shadow-sm border-accent/20 bg-accent/5">
              <CardContent className="p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6 text-accent" />
                </div>
                <p className="text-accent font-medium">Order Delivered Successfully!</p>
              </CardContent>
            </Card>

            {/* Review Form - Show only if not reviewed */}
            {!hasReviewed && order.restaurants && (
              <ReviewForm
                orderId={order.id}
                restaurantId={order.restaurant_id}
                customerId={user!.id}
                restaurantName={order.restaurants.name}
                onReviewSubmitted={() => setHasReviewed(true)}
              />
            )}

            {/* Already Reviewed Message */}
            {hasReviewed && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-muted-foreground">Thank you for your review!</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
