import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus, DeliveryPartner } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Bike, 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  Package,
  Clock,
  CheckCircle,
  Phone,
  Key,
  Banknote,
  Smartphone,
  AlertCircle,
  Shield,
  History,
  Wallet,
  IndianRupee,
  TrendingUp,
  User,
  RefreshCw,
  ExternalLink,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrderWithDetails extends Order {
  restaurants: { name: string; address: string; phone: string | null } | null;
  customer_profile?: { full_name: string | null; phone: string | null } | null;
}

// Helper to generate short order ID
const getShortOrderId = (id: string) => {
  return `#${id.slice(0, 8).toUpperCase()}`;
};

export default function DeliveryDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPartner | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [availableOrders, setAvailableOrders] = useState<OrderWithDetails[]>([]);
  const [myOrders, setMyOrders] = useState<OrderWithDetails[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderWithDetails[]>([]);
  const [earnings, setEarnings] = useState({ today: 0, week: 0, total: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [deliveryOtpInputs, setDeliveryOtpInputs] = useState<Record<string, string>>({});
  const [deliveryOtpErrors, setDeliveryOtpErrors] = useState<Record<string, boolean>>({});
  const [pickupOtpInputs, setPickupOtpInputs] = useState<Record<string, string>>({});
  const [pickupOtpErrors, setPickupOtpErrors] = useState<Record<string, boolean>>({});
  
  // Phone verification states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationOtp, setVerificationOtp] = useState('');
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      fetchData();
    }
  }, [user, authLoading]);

  // Real-time order updates
  useEffect(() => {
    if (!deliveryPartner) return;

    const channel = supabase
      .channel('delivery-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryPartner]);

  const fetchData = async () => {
    try {
      // Check if user is a delivery partner
      const { data: partnerData } = await supabase
        .from('delivery_partners')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user!.id)
        .maybeSingle();

      if (profileData) setProfile(profileData);

      if (partnerData) {
        setDeliveryPartner(partnerData);
        
        // Fetch available orders (ready_for_pickup with no delivery partner)
        // Include pickup_otp for OTP verification
        const { data: availableData } = await supabase
          .from('orders')
          .select('*, restaurants(name, address, phone)')
          .eq('status', 'ready_for_pickup')
          .is('delivery_partner_id', null)
          .order('created_at', { ascending: false });

        if (availableData) {
          // Fetch customer profiles for available orders
          const customerIds = availableData.map(o => o.customer_id);
          let customerProfiles: { id: string; full_name: string | null; phone: string | null }[] = [];
          
          if (customerIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, full_name, phone')
              .in('id', customerIds);
            customerProfiles = profilesData || [];
          }

          const ordersWithProfiles = availableData.map(order => ({
            ...order,
            customer_profile: customerProfiles.find(p => p.id === order.customer_id) || null
          }));
          setAvailableOrders(ordersWithProfiles);
        }

        // Fetch my orders with customer info
        const { data: myOrdersData } = await supabase
          .from('orders')
          .select('*, restaurants(name, address, phone)')
          .eq('delivery_partner_id', partnerData.id)
          .in('status', ['picked_up', 'on_the_way'])
          .order('created_at', { ascending: false });

        if (myOrdersData) {
          // Fetch customer profiles for my orders
          const customerIds = myOrdersData.map(o => o.customer_id);
          let customerProfiles: { id: string; full_name: string | null; phone: string | null }[] = [];
          
          if (customerIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, full_name, phone')
              .in('id', customerIds);
            customerProfiles = profilesData || [];
          }

          const ordersWithProfiles = myOrdersData.map(order => ({
            ...order,
            customer_profile: customerProfiles.find(p => p.id === order.customer_id) || null
          }));
          setMyOrders(ordersWithProfiles);
        }

        // Fetch order history (completed/cancelled)
        const { data: historyData } = await supabase
          .from('orders')
          .select('*, restaurants(name, address, phone)')
          .eq('delivery_partner_id', partnerData.id)
          .in('status', ['delivered', 'cancelled'])
          .order('created_at', { ascending: false })
          .limit(50);

        if (historyData) setOrderHistory(historyData);

        // Calculate earnings
        const deliveredOrders = historyData?.filter(o => o.status === 'delivered') || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const deliveryFee = 30; // Fixed delivery fee per order
        const todayEarnings = deliveredOrders
          .filter(o => new Date(o.created_at) >= today)
          .length * deliveryFee;
        const weekEarnings = deliveredOrders
          .filter(o => new Date(o.created_at) >= weekAgo)
          .length * deliveryFee;
        const totalEarnings = deliveredOrders.length * deliveryFee;
        const pendingSettlement = Math.floor(totalEarnings * 0.2); // 20% pending

        setEarnings({
          today: todayEarnings,
          week: weekEarnings,
          total: totalEarnings,
          pending: pendingSettlement
        });
      } else {
        setShowRegister(true);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const sendVerificationOtp = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    // Generate OTP (demo mode - show in app)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    setShowVerificationInput(true);
    toast.success(`Demo OTP: ${otp} (In production, this would be sent via SMS)`);
  };

  const verifyPhoneOtp = () => {
    if (verificationOtp === generatedOtp) {
      registerAsPartner();
    } else {
      toast.error('Invalid OTP. Please try again.');
    }
  };

  const registerAsPartner = async () => {
    const { data, error } = await supabase
      .from('delivery_partners')
      .insert({
        user_id: user!.id,
        is_available: false,
        vehicle_type: 'Bike',
        phone: phoneNumber,
        phone_verified: true,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      // Use secure RPC to assign delivery_partner role
      await supabase.rpc('request_delivery_partner_role');
      
      setDeliveryPartner(data);
      setShowRegister(false);
      toast.success('Registered as delivery partner!');
    }
  };

  const toggleAvailability = async () => {
    if (!deliveryPartner) return;

    const { error } = await supabase
      .from('delivery_partners')
      .update({ is_available: !deliveryPartner.is_available })
      .eq('id', deliveryPartner.id);

    if (error) {
      toast.error('Failed to update availability');
    } else {
      setDeliveryPartner({ ...deliveryPartner, is_available: !deliveryPartner.is_available });
      toast.success(deliveryPartner.is_available ? 'You are now offline' : 'You are now online');
      if (!deliveryPartner.is_available) fetchData(); // Refresh available orders
    }
  };

  const verifyPickupAndAccept = async (order: OrderWithDetails) => {
    if (!deliveryPartner) return;
    
    const otpValue = pickupOtpInputs[order.id] || '';
    
    // Use secure server-side RPC for OTP verification
    const { data, error } = await supabase.rpc('verify_pickup_and_accept_order', {
      _order_id: order.id,
      _pickup_otp: otpValue
    });

    if (error) {
      toast.error('Failed to accept order');
      return;
    }
    
    if (data) {
      toast.success('Order accepted!');
      setPickupOtpInputs(prev => ({ ...prev, [order.id]: '' }));
      setPickupOtpErrors(prev => ({ ...prev, [order.id]: false }));
      fetchData();
    } else {
      setPickupOtpErrors(prev => ({ ...prev, [order.id]: true }));
      toast.error('Invalid pickup OTP. Please check with the restaurant.');
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      setDeliveryOtpInputs(prev => ({ ...prev, [orderId]: '' }));
      setDeliveryOtpErrors(prev => ({ ...prev, [orderId]: false }));
      fetchData();
    }
  };

  const verifyAndDeliver = async (order: OrderWithDetails) => {
    const otpValue = deliveryOtpInputs[order.id] || '';
    
    // Use secure server-side RPC for OTP verification
    const { data, error } = await supabase.rpc('verify_delivery_and_complete', {
      _order_id: order.id,
      _delivery_otp: otpValue
    });

    if (error) {
      toast.error('Failed to update status');
      return;
    }
    
    if (data) {
      toast.success('Order delivered!');
      setDeliveryOtpInputs(prev => ({ ...prev, [order.id]: '' }));
      setDeliveryOtpErrors(prev => ({ ...prev, [order.id]: false }));
      fetchData();
    } else {
      setDeliveryOtpErrors(prev => ({ ...prev, [order.id]: true }));
      toast.error('Invalid OTP. Please check with the customer.');
    }
  };

  const cancelOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to cancel order');
    } else {
      toast.success('Order cancelled');
      setDeliveryOtpInputs(prev => ({ ...prev, [orderId]: '' }));
      setDeliveryOtpErrors(prev => ({ ...prev, [orderId]: false }));
      fetchData();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (showRegister) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 max-w-md">
          <Card className="border-0 shadow-lg">
            <CardContent className="py-8">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bike className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Become a Delivery Partner</h2>
                <p className="text-muted-foreground">
                  Earn money delivering food to customers in your area
                </p>
              </div>

              {!showVerificationInput ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button onClick={sendVerificationOtp} className="w-full" size="lg">
                    <Shield className="w-4 h-4 mr-2" />
                    Send Verification OTP
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 text-center">
                    <p className="text-sm text-accent font-medium">Demo OTP: {generatedOtp}</p>
                    <p className="text-xs text-muted-foreground mt-1">In production, this would be sent via SMS</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp">Enter OTP</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 4-digit OTP"
                      value={verificationOtp}
                      onChange={(e) => setVerificationOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="font-mono text-center text-lg tracking-widest"
                      maxLength={4}
                    />
                  </div>
                  <Button onClick={verifyPhoneOtp} className="w-full" size="lg" disabled={verificationOtp.length !== 4}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verify & Register
                  </Button>
                  <Button variant="outline" onClick={() => setShowVerificationInput(false)} className="w-full">
                    Change Phone Number
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentOrder = myOrders[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-primary" />
                <div>
                  <h1 className="text-lg font-bold leading-tight">Delivery Dashboard</h1>
                  {profile?.full_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" /> {profile.full_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${deliveryPartner?.is_available ? 'text-accent' : 'text-muted-foreground'}`}>
                  {deliveryPartner?.is_available ? 'Online' : 'Offline'}
                </span>
                <Switch
                  checked={deliveryPartner?.is_available || false}
                  onCheckedChange={toggleAvailability}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="active" className="gap-2">
              <Package className="w-4 h-4" />
              Active
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="earnings" className="gap-2">
              <Wallet className="w-4 h-4" />
              Earnings
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 text-center">
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${deliveryPartner?.is_available ? 'bg-accent animate-pulse' : 'bg-muted-foreground'}`} />
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={`font-semibold text-sm ${deliveryPartner?.is_available ? 'text-accent' : 'text-muted-foreground'}`}>
                    {deliveryPartner?.is_available ? 'Online' : 'Offline'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 text-center">
                  <Package className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="font-semibold text-sm">{availableOrders.length} orders</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 text-center">
                  <CheckCircle className="w-4 h-4 mx-auto mb-1 text-status-delivered" />
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="font-semibold text-sm">₹{earnings.today}</p>
                </CardContent>
              </Card>
            </div>

            {/* Current Delivery */}
            {currentOrder && (
              <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 to-accent/5">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      Current Delivery
                    </div>
                    <span className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                      {getShortOrderId(currentOrder.id)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-lg">{currentOrder.restaurants?.name}</p>
                        <StatusBadge status={currentOrder.status as OrderStatus} />
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">₹{Number(currentOrder.total_amount).toFixed(2)}</p>
                        <span className="flex items-center gap-1 text-xs mt-1">
                          {currentOrder.payment_method === 'cod' ? (
                            <span className="flex items-center gap-1 bg-accent/10 text-accent px-2 py-1 rounded-full">
                              <Banknote className="w-3 h-3" /> COD
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full">
                              <Smartphone className="w-3 h-3" /> GPay
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{currentOrder.customer_profile?.full_name || 'Customer'}</p>
                          <p className="text-sm text-muted-foreground">Customer</p>
                        </div>
                      </div>
                      {currentOrder.customer_profile?.phone && (
                        <a 
                          href={`tel:${currentOrder.customer_profile.phone}`}
                          className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg font-medium hover:bg-accent/90 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          Call
                        </a>
                      )}
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-start gap-3 p-3 bg-card rounded-lg">
                        <MapPin className="w-5 h-5 text-accent mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">Pickup from</p>
                          <p className="font-medium">{currentOrder.restaurants?.address}</p>
                          <div className="flex items-center gap-3 mt-2">
                            {currentOrder.restaurants?.phone && (
                              <a href={`tel:${currentOrder.restaurants.phone}`} className="flex items-center gap-1 text-primary text-sm hover:underline">
                                <Phone className="w-3 h-3" />
                                Call Shop
                              </a>
                            )}
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentOrder.restaurants?.address || '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-accent text-sm hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Navigate
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-card rounded-lg">
                        <Navigation className="w-5 h-5 text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">Deliver to</p>
                          <p className="font-medium">{currentOrder.delivery_address}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentOrder.delivery_address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary text-sm hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Navigate
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {currentOrder.status === 'on_the_way' && (
                        <div className="space-y-3">
                          <div className="p-3 bg-card rounded-lg border-2 border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Key className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium">Enter Customer OTP</span>
                            </div>
                            <Input
                              type="text"
                              placeholder="Enter 4-digit OTP"
                              value={deliveryOtpInputs[currentOrder.id] || ''}
                              onChange={(e) => {
                                setDeliveryOtpInputs(prev => ({ ...prev, [currentOrder.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }));
                                setDeliveryOtpErrors(prev => ({ ...prev, [currentOrder.id]: false }));
                              }}
                              className={`font-mono text-center text-lg tracking-widest ${deliveryOtpErrors[currentOrder.id] ? 'border-destructive' : ''}`}
                              maxLength={4}
                            />
                            {deliveryOtpErrors[currentOrder.id] && (
                              <div className="flex items-center gap-1 text-destructive text-sm mt-2">
                                <AlertCircle className="w-3 h-3" />
                                <span>Invalid OTP</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              className="flex-1" 
                              variant="success" 
                              onClick={() => verifyAndDeliver(currentOrder)}
                              disabled={(deliveryOtpInputs[currentOrder.id] || '').length !== 4}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Verify & Deliver
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <X className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Delivery</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel this delivery? This will mark the order as cancelled.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>No, Keep Delivery</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => cancelOrder(currentOrder.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Yes, Cancel
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                      {currentOrder.status === 'picked_up' && (
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => updateOrderStatus(currentOrder.id, 'on_the_way')}>
                            <Navigation className="w-4 h-4 mr-2" />
                            Start Delivery
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon">
                                <X className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Delivery</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to cancel this delivery? This will mark the order as cancelled.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>No, Keep Delivery</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelOrder(currentOrder.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Yes, Cancel
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Available Orders */}
            {deliveryPartner?.is_available && !currentOrder && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Available Orders
                  {availableOrders.length > 0 && (
                    <span className="w-6 h-6 bg-primary text-primary-foreground text-sm rounded-full flex items-center justify-center">
                      {availableOrders.length}
                    </span>
                  )}
                </h2>

                {availableOrders.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">No orders available right now</p>
                      <p className="text-sm text-muted-foreground mt-1">New orders will appear here automatically</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {availableOrders.map((order) => (
                      <Card key={order.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{order.restaurants?.name}</p>
                                <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">
                                  {getShortOrderId(order.id)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Clock className="w-4 h-4" />
                                {format(new Date(order.created_at), 'h:mm a')}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">₹{Number(order.total_amount).toFixed(2)}</p>
                              <span className="flex items-center gap-1 text-xs mt-1 justify-end">
                                {order.payment_method === 'cod' ? (
                                  <span className="flex items-center gap-1 bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                                    <Banknote className="w-3 h-3" /> COD
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    <Smartphone className="w-3 h-3" /> GPay
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Customer Info */}
                          <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg mb-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{order.customer_profile?.full_name || 'Customer'}</span>
                            </div>
                            {order.customer_profile?.phone && (
                              <a 
                                href={`tel:${order.customer_profile.phone}`}
                                className="flex items-center gap-1 text-primary text-xs hover:underline"
                              >
                                <Phone className="w-3 h-3" />
                                Call
                              </a>
                            )}
                          </div>

                          <div className="space-y-2 text-sm mb-4">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-accent mt-0.5" />
                              <div className="flex-1">
                                <span className="text-muted-foreground">{order.restaurants?.address}</span>
                                <div className="flex items-center gap-3 mt-1">
                                  {order.restaurants?.phone && (
                                    <a href={`tel:${order.restaurants.phone}`} className="flex items-center gap-1 text-primary text-xs hover:underline">
                                      <Phone className="w-3 h-3" />
                                      Call Shop
                                    </a>
                                  )}
                                  <a 
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.restaurants?.address || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-accent text-xs hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Map
                                  </a>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <Navigation className="w-4 h-4 text-primary mt-0.5" />
                              <span className="text-muted-foreground">{order.delivery_address}</span>
                            </div>
                          </div>

                          {/* Pickup OTP verification */}
                          <div className="space-y-3">
                            <div className="p-3 bg-card rounded-lg border">
                              <div className="flex items-center gap-2 mb-2">
                                <Key className="w-4 h-4 text-accent" />
                                <span className="text-sm font-medium">Enter Pickup OTP from Shop</span>
                              </div>
                              <Input
                                type="text"
                                placeholder="Enter 4-digit OTP"
                                value={pickupOtpInputs[order.id] || ''}
                                onChange={(e) => {
                                  setPickupOtpInputs(prev => ({ ...prev, [order.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }));
                                  setPickupOtpErrors(prev => ({ ...prev, [order.id]: false }));
                                }}
                                className={`font-mono text-center text-lg tracking-widest ${pickupOtpErrors[order.id] ? 'border-destructive' : ''}`}
                                maxLength={4}
                              />
                              {pickupOtpErrors[order.id] && (
                                <div className="flex items-center gap-1 text-destructive text-sm mt-2">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Invalid OTP</span>
                                </div>
                              )}
                            </div>
                            <Button 
                              className="w-full" 
                              onClick={() => verifyPickupAndAccept(order)}
                              disabled={(pickupOtpInputs[order.id] || '').length !== 4}
                            >
                              Verify & Accept Order
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Offline State */}
            {!deliveryPartner?.is_available && !currentOrder && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Bike className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">You're Offline</h3>
                  <p className="text-muted-foreground mb-4">Go online to start receiving delivery requests</p>
                  <Button onClick={toggleAvailability}>Go Online</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" />
              Order History
            </h2>

            {orderHistory.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No completed deliveries yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Your delivery history will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {orderHistory.map((order) => (
                  <Card key={order.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{order.restaurants?.name}</p>
                            <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded">
                              {getShortOrderId(order.id)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-4 h-4" />
                            {format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={order.status as OrderStatus} />
                          <p className="font-bold text-primary mt-1">₹{Number(order.total_amount).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Navigation className="w-4 h-4" />
                        <span className="truncate">{order.delivery_address}</span>
                      </div>
                      {order.status === 'delivered' && (
                        <div className="mt-2 flex items-center gap-1 text-accent text-sm">
                          <IndianRupee className="w-3 h-3" />
                          <span>Earned: ₹30</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="earnings" className="space-y-6">
            {/* Earnings Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <IndianRupee className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Today</p>
                      <p className="text-xl font-bold">₹{earnings.today}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">This Week</p>
                      <p className="text-xl font-bold">₹{earnings.week}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-status-delivered/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-status-delivered" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Earned</p>
                      <p className="text-xl font-bold">₹{earnings.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-status-pending/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-status-pending" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-xl font-bold">₹{earnings.pending}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Settlement Info */}
            <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-accent/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Settlement Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-card rounded-lg">
                    <span className="text-muted-foreground">Delivery fee per order</span>
                    <span className="font-bold">₹30</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-card rounded-lg">
                    <span className="text-muted-foreground">Total deliveries</span>
                    <span className="font-bold">{orderHistory.filter(o => o.status === 'delivered').length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-card rounded-lg">
                    <span className="text-muted-foreground">Settlement cycle</span>
                    <span className="font-bold">Weekly</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Settlements are processed every Monday to your registered bank account
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            {/* Profile Info */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Partner Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{profile?.full_name || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{deliveryPartner?.phone || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Vehicle Type</span>
                  <span className="font-medium flex items-center gap-2">
                    <Bike className="w-4 h-4" />
                    {deliveryPartner?.vehicle_type || 'Bike'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Phone Verified</span>
                  <span className={`font-medium flex items-center gap-1 ${deliveryPartner?.phone_verified ? 'text-accent' : 'text-destructive'}`}>
                    {deliveryPartner?.phone_verified ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Verified
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        Not Verified
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-medium ${deliveryPartner?.is_available ? 'text-accent' : 'text-muted-foreground'}`}>
                    {deliveryPartner?.is_available ? 'Online' : 'Offline'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Stats */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Delivery Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Total Deliveries</span>
                  <span className="font-bold text-lg">{orderHistory.filter(o => o.status === 'delivered').length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Cancelled Orders</span>
                  <span className="font-bold text-lg">{orderHistory.filter(o => o.status === 'cancelled').length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-bold text-lg text-accent">
                    {orderHistory.length > 0 
                      ? Math.round((orderHistory.filter(o => o.status === 'delivered').length / orderHistory.length) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="font-medium">
                    {deliveryPartner?.created_at 
                      ? format(new Date(deliveryPartner.created_at), 'MMM d, yyyy')
                      : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Help & Support */}
            <Card className="border-0 shadow-sm">
              <CardContent className="py-6 text-center">
                <Phone className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">Need help?</p>
                <a href="tel:+919876543210" className="text-primary font-medium hover:underline">
                  Contact Support
                </a>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
