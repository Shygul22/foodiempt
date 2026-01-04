import React, { useState, useEffect, forwardRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Textarea } from '@/components/ui/textarea';
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Package, Clock, Banknote, Smartphone, Key, XCircle, RotateCcw, MapPin, Phone, Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface OrderWithRestaurant extends Order {
  restaurants: { name: string; phone: string | null } | null;
}

interface OrderRating {
  order_id: string;
  rating: number;
}

// Helper to generate short order ID
const getShortOrderId = (id: string) => {
  return `#${id.slice(0, 8).toUpperCase()}`;
};

// Order tracking steps
const orderSteps: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Order Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready_for_pickup', label: 'Ready' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'on_the_way', label: 'On the Way' },
  { status: 'delivered', label: 'Delivered' },
];

const getStepIndex = (status: OrderStatus) => {
  if (status === 'cancelled') return -1;
  return orderSteps.findIndex(s => s.status === status);
};

const OrdersPage = forwardRef<HTMLDivElement>((_, ref) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<OrderRating[]>([]);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingDeliveryPartnerId, setRatingDeliveryPartnerId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      fetchOrders();
      fetchRatings();
      const cleanup = subscribeToOrders();
      return cleanup;
    }
  }, [user, authLoading]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, restaurants(name, phone)')
      .eq('customer_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const fetchRatings = async () => {
    const { data } = await supabase
      .from('order_ratings')
      .select('order_id, rating')
      .eq('customer_id', user!.id);

    if (data) {
      setRatings(data);
    }
  };

  const hasRated = (orderId: string) => {
    return ratings.some(r => r.order_id === orderId);
  };

  const getOrderRating = (orderId: string) => {
    return ratings.find(r => r.order_id === orderId)?.rating || 0;
  };

  const openRatingDialog = (orderId: string, deliveryPartnerId: string | null) => {
    setRatingOrderId(orderId);
    setRatingDeliveryPartnerId(deliveryPartnerId);
    setSelectedRating(0);
    setFeedback('');
    setRatingDialogOpen(true);
  };

  const submitRating = async () => {
    if (!ratingOrderId || selectedRating === 0) return;

    setSubmittingRating(true);
    const { error } = await supabase
      .from('order_ratings')
      .insert({
        order_id: ratingOrderId,
        customer_id: user!.id,
        delivery_partner_id: ratingDeliveryPartnerId,
        rating: selectedRating,
        feedback: feedback.trim() || null,
      });

    if (error) {
      toast.error('Failed to submit rating');
    } else {
      toast.success('Thank you for your feedback!');
      fetchRatings();
      setRatingDialogOpen(false);
    }
    setSubmittingRating(false);
  };

  const subscribeToOrders = () => {
    const channel = supabase
      .channel('customer-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user!.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const cancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('customer_id', user!.id);

    if (error) {
      toast.error('Failed to cancel order');
    } else {
      toast.success('Order cancelled successfully');
      fetchOrders();
    }
    setCancellingId(null);
  };

  const canCancelOrder = (status: OrderStatus) => {
    return ['pending', 'confirmed'].includes(status);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">My Orders</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground mb-6">Start by ordering from your favorite shop</p>
            <Link to="/">
              <Button variant="hero">Browse Shops</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const currentStep = getStepIndex(order.status as OrderStatus);
              const isCancelled = order.status === 'cancelled';
              const isDelivered = order.status === 'delivered';
              const isActive = !isCancelled && !isDelivered;

              return (
                <Card key={order.id} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {/* Header - Clickable for tracking */}
                    <Link to={`/order/${order.id}`} className="block">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg hover:text-primary transition-colors">
                              {order.restaurants?.name || 'Unknown Shop'}
                            </h3>
                            <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">
                              {getShortOrderId(order.id)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-4 h-4" />
                            <span>{format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</span>
                          </div>
                        </div>
                        <StatusBadge status={order.status as OrderStatus} />
                      </div>
                    </Link>

                    {/* Order Tracking Steps for Active Orders */}
                    {isActive && (
                      <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center justify-between overflow-x-auto gap-1">
                          {orderSteps.slice(0, 7).map((step, index) => (
                            <div key={step.status} className="flex flex-col items-center min-w-[50px]">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                index <= currentStep 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {index + 1}
                              </div>
                              <span className={`text-[10px] mt-1 text-center ${
                                index <= currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
                              }`}>
                                {step.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shop Contact */}
                    {order.restaurants?.phone && isActive && (
                      <div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg mb-3">
                        <span className="text-sm text-muted-foreground">Contact Shop</span>
                        <a 
                          href={`tel:${order.restaurants.phone}`}
                          className="flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                        >
                          <Phone className="w-4 h-4" />
                          Call
                        </a>
                      </div>
                    )}

                    {/* Amount and Payment */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-2">
                        {order.payment_method === 'cod' ? (
                          <span className="flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                            <Banknote className="w-3 h-3" /> COD
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            <Smartphone className="w-3 h-3" /> GPay
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-primary text-lg">
                        ₹{Number(order.total_amount).toFixed(2)}
                      </span>
                    </div>

                    {/* Delivery Address */}
                    {order.delivery_address && (
                      <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="truncate">{order.delivery_address}</span>
                      </div>
                    )}

                    {/* Show OTP for active orders */}
                    {order.delivery_otp && isActive && (
                      <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-primary">Delivery OTP:</span>
                          <span className="font-mono font-bold text-lg text-primary tracking-widest">{order.delivery_otp}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Share this code with your delivery partner</p>
                      </div>
                    )}

                    {/* Cancel Order Button */}
                    {canCancelOrder(order.status as OrderStatus) && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                              disabled={cancellingId === order.id}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this order? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Order</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => cancelOrder(order.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Yes, Cancel Order
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}

                    {/* Rating Section for delivered orders */}
                    {isDelivered && (
                      <div className="mt-4 pt-3 border-t border-border">
                        {hasRated(order.id) ? (
                          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
                            <span className="text-sm text-muted-foreground">Your rating:</span>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= getOrderRating(order.id)
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-muted-foreground'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => openRatingDialog(order.id, order.delivery_partner_id)}
                          >
                            <Star className="w-4 h-4 mr-2" />
                            Rate Your Experience
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Reorder Button for completed/cancelled orders */}
                    {(isDelivered || isCancelled) && (
                      <div className="mt-3">
                        <Link to={`/restaurant/${order.restaurant_id}`}>
                          <Button variant="outline" className="w-full">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Order Again
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Rating Dialog */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Your Delivery</DialogTitle>
            <DialogDescription>
              How was your delivery experience? Your feedback helps us improve.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Star Rating */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= selectedRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground hover:text-yellow-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {selectedRating === 0 && 'Tap to rate'}
              {selectedRating === 1 && 'Poor'}
              {selectedRating === 2 && 'Fair'}
              {selectedRating === 3 && 'Good'}
              {selectedRating === 4 && 'Very Good'}
              {selectedRating === 5 && 'Excellent!'}
            </p>
            {/* Feedback */}
            <Textarea
              placeholder="Share your feedback (optional)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRatingDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitRating}
              disabled={selectedRating === 0 || submittingRating}
            >
              {submittingRating ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

OrdersPage.displayName = 'OrdersPage';

export default OrdersPage;
