import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderStatus, DeliveryPartner } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
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
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrderWithDetails extends Order {
  restaurants: { name: string; address: string; phone: string | null } | null;
}

export default function DeliveryDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [deliveryPartner, setDeliveryPartner] = useState<DeliveryPartner | null>(null);
  const [availableOrders, setAvailableOrders] = useState<OrderWithDetails[]>([]);
  const [myOrders, setMyOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      fetchData();
    }
  }, [user, authLoading]);

  const fetchData = async () => {
    // Check if user is a delivery partner
    const { data: partnerData } = await supabase
      .from('delivery_partners')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (partnerData) {
      setDeliveryPartner(partnerData);
      
      // Fetch available orders (ready_for_pickup with no delivery partner)
      const { data: availableData } = await supabase
        .from('orders')
        .select('*, restaurants(name, address, phone)')
        .eq('status', 'ready_for_pickup')
        .is('delivery_partner_id', null)
        .order('created_at', { ascending: false });

      if (availableData) setAvailableOrders(availableData);

      // Fetch my orders
      const { data: myOrdersData } = await supabase
        .from('orders')
        .select('*, restaurants(name, address, phone)')
        .eq('delivery_partner_id', partnerData.id)
        .in('status', ['picked_up', 'on_the_way'])
        .order('created_at', { ascending: false });

      if (myOrdersData) setMyOrders(myOrdersData);
    } else {
      setShowRegister(true);
    }

    setLoading(false);
  };

  const registerAsPartner = async () => {
    const { data, error } = await supabase
      .from('delivery_partners')
      .insert({
        user_id: user!.id,
        is_available: false,
        vehicle_type: 'Bike',
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      // Add delivery_partner role
      await supabase.from('user_roles').insert({
        user_id: user!.id,
        role: 'delivery_partner',
      });
      
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

  const acceptOrder = async (orderId: string) => {
    if (!deliveryPartner) return;

    const { error } = await supabase
      .from('orders')
      .update({ 
        delivery_partner_id: deliveryPartner.id,
        status: 'picked_up' 
      })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to accept order');
    } else {
      toast.success('Order accepted!');
      fetchData();
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
      setOtpInput('');
      setOtpError(false);
      fetchData();
    }
  };

  const verifyAndDeliver = (order: OrderWithDetails) => {
    if (otpInput === order.delivery_otp) {
      updateOrderStatus(order.id, 'delivered');
    } else {
      setOtpError(true);
      toast.error('Invalid OTP. Please check with the customer.');
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
          <Card className="border-0 shadow-lg text-center">
            <CardContent className="py-12">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bike className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Become a Delivery Partner</h2>
              <p className="text-muted-foreground mb-6">
                Earn money delivering food to customers in your area
              </p>
              <Button onClick={registerAsPartner} size="lg">
                Register as Partner
              </Button>
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
                <h1 className="text-xl font-bold">Delivery Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
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
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Current Delivery */}
        {currentOrder && (
          <Card className="border-0 shadow-lg mb-6 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Current Delivery
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
                    <p className="font-bold text-primary">${Number(currentOrder.total_amount).toFixed(2)}</p>
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

                <div className="grid gap-3">
                  <div className="flex items-start gap-3 p-3 bg-card rounded-lg">
                    <MapPin className="w-5 h-5 text-accent mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup from</p>
                      <p className="font-medium">{currentOrder.restaurants?.address}</p>
                      {currentOrder.restaurants?.phone && (
                        <a href={`tel:${currentOrder.restaurants.phone}`} className="flex items-center gap-1 text-primary text-sm mt-1">
                          <Phone className="w-3 h-3" />
                          {currentOrder.restaurants.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-card rounded-lg">
                    <Navigation className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Deliver to</p>
                      <p className="font-medium">{currentOrder.delivery_address}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {currentOrder.status === 'picked_up' && (
                    <Button className="w-full" onClick={() => updateOrderStatus(currentOrder.id, 'on_the_way')}>
                      <Navigation className="w-4 h-4 mr-2" />
                      Start Delivery
                    </Button>
                  )}
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
                          value={otpInput}
                          onChange={(e) => {
                            setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                            setOtpError(false);
                          }}
                          className={`font-mono text-center text-lg tracking-widest ${otpError ? 'border-destructive' : ''}`}
                          maxLength={4}
                        />
                        {otpError && (
                          <div className="flex items-center gap-1 text-destructive text-sm mt-2">
                            <AlertCircle className="w-3 h-3" />
                            <span>Invalid OTP</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        className="w-full" 
                        variant="success" 
                        onClick={() => verifyAndDeliver(currentOrder)}
                        disabled={otpInput.length !== 4}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Verify & Mark Delivered
                      </Button>
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
                          <p className="font-semibold">{order.restaurants?.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-4 h-4" />
                            {format(new Date(order.created_at), 'h:mm a')}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">${Number(order.total_amount).toFixed(2)}</p>
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

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-accent mt-0.5" />
                          <span className="text-muted-foreground">{order.restaurants?.address}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Navigation className="w-4 h-4 text-primary mt-0.5" />
                          <span className="text-muted-foreground">{order.delivery_address}</span>
                        </div>
                      </div>

                      <Button className="w-full" onClick={() => acceptOrder(order.id)}>
                        Accept Order
                      </Button>
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
      </div>
    </div>
  );
}
