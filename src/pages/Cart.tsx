import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation, calculateDistance, calculateDeliveryFee, formatDistance } from '@/hooks/useGeolocation';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { AddressSelector } from '@/components/AddressSelector';
import { ScheduleDelivery } from '@/components/ScheduleDelivery';
import { 
  ArrowLeft, 
  Minus, 
  Plus, 
  Trash2, 
  ShoppingBag,
  Banknote,
  Smartphone,
  MapPin,
  Bike,
  Clock,
  Zap,
  Store
} from 'lucide-react';
import { toast } from 'sonner';

type PaymentMethod = 'cod' | 'gpay';

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { latitude, longitude } = useGeolocation();
  const { items, restaurantId, updateQuantity, removeItem, clearCart, getTotalAmount } = useCartStore();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [restaurant, setRestaurant] = useState<{ lat: number | null; lng: number | null; name: string; address: string } | null>(null);

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurant();
    }
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('lat, lng, name, address')
      .eq('id', restaurantId!)
      .single();
    
    if (data) {
      setRestaurant(data);
    }
  };

  // Calculate distance and delivery fee
  const { distance, deliveryFee } = useMemo(() => {
    if (latitude && longitude && restaurant?.lat && restaurant?.lng) {
      const dist = calculateDistance(
        latitude,
        longitude,
        Number(restaurant.lat),
        Number(restaurant.lng)
      );
      return {
        distance: dist,
        deliveryFee: calculateDeliveryFee(dist)
      };
    }
    // Default fee when location not available
    return { distance: null, deliveryFee: 25 };
  }, [latitude, longitude, restaurant]);

  const handleScheduleChange = (scheduled: boolean, date: Date | null) => {
    setIsScheduled(scheduled);
    setScheduledAt(date);
  };

  // Free delivery threshold
  const subtotal = getTotalAmount();
  const freeDeliveryThreshold = 199;
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;
  const finalDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  const amountForFreeDelivery = freeDeliveryThreshold - subtotal;

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please sign in to checkout');
      navigate('/auth');
      return;
    }

    if (!deliveryAddress.trim()) {
      toast.error('Please enter a delivery address');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setLoading(true);

    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          restaurant_id: restaurantId!,
          total_amount: subtotal + finalDeliveryFee,
          delivery_address: deliveryAddress,
          delivery_lat: latitude,
          delivery_lng: longitude,
          notes: notes || null,
          status: 'pending',
          payment_method: paymentMethod,
          is_scheduled: isScheduled,
          scheduled_at: scheduledAt?.toISOString() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menuItem.id,
        quantity: item.quantity,
        unit_price: Number(item.menuItem.price),
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      clearCart();
      toast.success('Order placed successfully!');
      navigate('/orders');
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground mb-6">Add items to get started</p>
          <Link to="/">
            <Button className="rounded-full px-6">Browse Shops</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold">Your Cart</h1>
              {restaurant && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Store className="w-3 h-3" />
                  {restaurant.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Free Delivery Banner */}
      {!isFreeDelivery && amountForFreeDelivery > 0 && (
        <div className="bg-accent/10 border-b border-accent/20">
          <div className="container mx-auto px-4 py-2">
            <p className="text-xs text-center">
              <Zap className="w-3 h-3 inline mr-1 text-accent" />
              Add <span className="font-bold text-accent">₹{amountForFreeDelivery.toFixed(0)}</span> more for <span className="font-bold text-accent">FREE delivery</span>
            </p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <Card key={item.menuItem.id} className="overflow-hidden border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {item.menuItem.image_url ? (
                      <img
                        src={item.menuItem.image_url}
                        alt={item.menuItem.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm line-clamp-1">{item.menuItem.name}</h3>
                      <p className="text-primary font-bold text-sm">₹{Number(item.menuItem.price).toFixed(0)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 rounded-full"
                        onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 rounded-full"
                        onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.menuItem.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20 border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <AddressSelector
                  selectedAddress={deliveryAddress}
                  onAddressChange={setDeliveryAddress}
                />

                <ScheduleDelivery
                  isScheduled={isScheduled}
                  scheduledAt={scheduledAt}
                  onScheduleChange={handleScheduleChange}
                />

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs">Order Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label className="text-xs">Payment Method</Label>
                  <RadioGroup value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}>
                    <div className="flex items-center space-x-2 p-2.5 border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                        <Banknote className="w-4 h-4 text-accent" />
                        <span>Cash on Delivery</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-2.5 border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                      <RadioGroupItem value="gpay" id="gpay" />
                      <Label htmlFor="gpay" className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                        <Smartphone className="w-4 h-4 text-primary" />
                        <span>Google Pay</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Delivery Info */}
                {distance !== null && (
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        Distance
                      </span>
                      <span className="font-medium">{formatDistance(distance)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        Est. delivery
                      </span>
                      <span className="font-medium">20-30 min</span>
                    </div>
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5" />
                      Delivery Fee
                      {distance !== null && (
                        <span className="text-[10px] text-muted-foreground">({formatDistance(distance)})</span>
                      )}
                    </span>
                    <span className={isFreeDelivery ? 'text-accent line-through' : ''}>
                      ₹{deliveryFee}
                    </span>
                  </div>
                  {isFreeDelivery && (
                    <div className="flex justify-between text-sm">
                      <span className="text-accent flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Free Delivery!
                      </span>
                      <span className="text-accent font-medium">-₹{deliveryFee}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">₹{(subtotal + finalDeliveryFee).toFixed(0)}</span>
                  </div>
                </div>

                <Button
                  className="w-full rounded-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={loading}
                >
                  {loading ? 'Placing Order...' : `Place Order • ₹${(subtotal + finalDeliveryFee).toFixed(0)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
