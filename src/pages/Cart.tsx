import React, { useState, useEffect, forwardRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  Bike,
  Clock,
  Zap,
  Store,
  Tag,
  X,
  Check,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PaymentMethod = 'cod' | 'gpay';

interface AppliedCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  discountAmount: number;
}

const CartPage = forwardRef<HTMLDivElement>((_, ref) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, restaurantId, updateQuantity, removeItem, clearCart, getTotalAmount } = useCartStore();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [restaurant, setRestaurant] = useState<{ name: string; address: string } | null>(null);
  
  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  
  // Phone verification
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userPhone, setUserPhone] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurant();
    }
    if (user) {
      fetchUserPhone();
    }
  }, [restaurantId, user]);

  const fetchRestaurant = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('name, address')
      .eq('id', restaurantId!)
      .single();
    
    if (data) {
      setRestaurant(data);
    }
  };

  const fetchUserPhone = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user!.id)
      .maybeSingle();

    if (data?.phone) {
      setUserPhone(data.phone);
      setPhoneNumber(data.phone);
    }
  };

  // Fixed delivery fee
  const deliveryFee = 25;

  // Platform fee
  const platformFee = 8;

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

  // Coupon discount
  const couponDiscount = appliedCoupon?.discountAmount || 0;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    if (!user) {
      toast.error('Please sign in to apply coupons');
      navigate('/auth');
      return;
    }

    if (!userPhone) {
      setPhoneDialogOpen(true);
      return;
    }

    setApplyingCoupon(true);
    
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !coupon) {
      toast.error('Invalid or expired coupon code');
      setApplyingCoupon(false);
      return;
    }

    // Check minimum order amount
    if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
      toast.error(`Minimum order amount is ₹${coupon.min_order_amount}`);
      setApplyingCoupon(false);
      return;
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (subtotal * (coupon.discount_value || 0)) / 100;
      if (coupon.max_discount_amount) {
        discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
      }
    } else {
      discountAmount = coupon.discount_value || 0;
    }

    setAppliedCoupon({
      code: coupon.code,
      discount_type: coupon.discount_type || 'percentage',
      discount_value: coupon.discount_value || 0,
      max_discount_amount: coupon.max_discount_amount,
      discountAmount: discountAmount,
    });

    toast.success(`Coupon applied! You save ₹${discountAmount.toFixed(0)}`);
    setCouponCode('');
    setApplyingCoupon(false);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    toast.info('Coupon removed');
  };

  const handleSavePhone = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ phone: phoneNumber })
      .eq('id', user!.id);

    if (error) {
      toast.error('Failed to save phone number');
      return;
    }

    setUserPhone(phoneNumber);
    setPhoneDialogOpen(false);
    toast.success('Phone number saved!');
    // Now apply the coupon
    handleApplyCoupon();
  };

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
      // Create order with delivery fee
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          restaurant_id: restaurantId!,
          total_amount: Math.max(0, subtotal + finalDeliveryFee + platformFee - couponDiscount),
          delivery_address: deliveryAddress,
          notes: notes || null,
          status: 'pending',
          payment_method: paymentMethod,
          is_scheduled: isScheduled,
          scheduled_at: scheduledAt?.toISOString() || null,
          delivery_fee: finalDeliveryFee,
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

                {/* Coupon Section */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Apply Coupon
                  </Label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg border border-accent/30">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-accent" />
                        <span className="font-medium text-sm">{appliedCoupon.code}</span>
                        <span className="text-xs text-accent">-₹{appliedCoupon.discountAmount.toFixed(0)}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={removeCoupon}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleApplyCoupon}
                        disabled={applyingCoupon || !couponCode.trim()}
                      >
                        {applyingCoupon ? '...' : 'Apply'}
                      </Button>
                    </div>
                  )}
                  <Link to="/offers" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    View all offers
                  </Link>
                </div>

                {/* Delivery Info */}
                <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      Est. delivery
                    </span>
                    <span className="font-medium">20-30 min</span>
                  </div>
                </div>

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
                  {appliedCoupon && (
                    <div className="flex justify-between text-sm">
                      <span className="text-accent flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        Coupon Discount
                      </span>
                      <span className="text-accent font-medium">-₹{couponDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fee</span>
                    <span>₹{platformFee}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">₹{Math.max(0, subtotal + finalDeliveryFee + platformFee - couponDiscount).toFixed(0)}</span>
                  </div>
                </div>

                <Button
                  className="w-full rounded-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={loading}
                >
                  {loading ? 'Placing Order...' : `Place Order • ₹${Math.max(0, subtotal + finalDeliveryFee + platformFee - couponDiscount).toFixed(0)}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Phone Number Dialog */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Mobile Number Required
            </DialogTitle>
            <DialogDescription>
              Please add your mobile number to apply coupons and receive order updates.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="cart-phone">Mobile Number</Label>
            <Input
              id="cart-phone"
              type="tel"
              placeholder="Enter 10-digit mobile number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="mt-2"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground mt-2">
              We'll use this number to send order updates
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePhone} disabled={phoneNumber.length !== 10}>
              Save & Apply Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

CartPage.displayName = 'CartPage';

export default CartPage;
