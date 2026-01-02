import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Restaurant, Order, OrderStatus, DeliveryPartner } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/StatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Shield, 
  Store, 
  Package, 
  DollarSign, 
  ArrowLeft,
  Check,
  X,
  Percent,
  Bike,
  MapPin,
  TrendingUp,
  Clock,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RestaurantWithStats extends Restaurant {
  orders_count?: number;
}

interface OrderWithDetails extends Order {
  restaurants: { name: string } | null;
}

interface DeliveryPartnerWithProfile extends DeliveryPartner {
  user_id: string;
}

export default function AdminDashboard() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerWithProfile[]>([]);
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    verifiedRestaurants: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeOrders: 0,
    totalPartners: 0,
  });
  const [loading, setLoading] = useState(true);
  const [commissionUpdates, setCommissionUpdates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading) {
      if (!user || !hasRole('super_admin')) {
        toast.error('Access denied');
        navigate('/');
        return;
      }
      fetchData();
      subscribeToChanges();
    }
  }, [user, authLoading, hasRole]);

  const fetchData = async () => {
    const [restaurantsRes, ordersRes, partnersRes] = await Promise.all([
      supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, restaurants(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('delivery_partners').select('*'),
    ]);

    if (restaurantsRes.data) {
      setRestaurants(restaurantsRes.data);
      setStats((prev) => ({
        ...prev,
        totalRestaurants: restaurantsRes.data.length,
        verifiedRestaurants: restaurantsRes.data.filter((r) => r.is_verified).length,
      }));
    }

    if (ordersRes.data) {
      setOrders(ordersRes.data);
      const activeOrders = ordersRes.data.filter(o => 
        !['delivered', 'cancelled'].includes(o.status)
      ).length;
      const totalRevenue = ordersRes.data.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0
      );
      setStats((prev) => ({
        ...prev,
        totalOrders: ordersRes.data.length,
        totalRevenue,
        activeOrders,
      }));
    }

    if (partnersRes.data) {
      setDeliveryPartners(partnersRes.data);
      setStats((prev) => ({
        ...prev,
        totalPartners: partnersRes.data.length,
      }));
    }

    setLoading(false);
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('admin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleVerification = async (restaurantId: string, isVerified: boolean) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ is_verified: isVerified })
      .eq('id', restaurantId);

    if (error) {
      toast.error('Failed to update verification status');
    } else {
      toast.success(isVerified ? 'Shop verified' : 'Verification removed');
      fetchData();
    }
  };

  const updateCommission = async (restaurantId: string) => {
    const rate = parseFloat(commissionUpdates[restaurantId]);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Invalid commission rate');
      return;
    }

    const { error } = await supabase
      .from('restaurants')
      .update({ commission_rate: rate })
      .eq('id', restaurantId);

    if (error) {
      toast.error('Failed to update commission rate');
    } else {
      toast.success('Commission rate updated');
      setCommissionUpdates((prev) => ({ ...prev, [restaurantId]: '' }));
      fetchData();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
                  Admin Dashboard
                </h1>
                <p className="text-xs text-muted-foreground">Manage your platform</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Shops</p>
                  <p className="text-2xl font-bold text-primary">{stats.totalRestaurants}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-accent/5 to-accent/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Verified</p>
                  <p className="text-2xl font-bold text-accent">{stats.verifiedRestaurants}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-status-confirmed/5 to-status-confirmed/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-confirmed/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-status-confirmed" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Orders</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-status-pending/5 to-status-pending/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-pending/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-status-pending" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Active</p>
                  <p className="text-2xl font-bold text-status-pending">{stats.activeOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-status-delivered/5 to-status-delivered/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-delivered/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-status-delivered" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Revenue</p>
                  <p className="text-2xl font-bold text-status-delivered">₹{stats.totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-status-preparing/5 to-status-preparing/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-preparing/20 flex items-center justify-center">
                  <Bike className="w-5 h-5 text-status-preparing" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Partners</p>
                  <p className="text-2xl font-bold text-status-preparing">{stats.totalPartners}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid - All controls on same page */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Shops Management */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="w-5 h-5 text-primary" />
                Shop Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-3">
                  {restaurants.map((restaurant) => (
                    <div 
                      key={restaurant.id} 
                      className="p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold truncate">{restaurant.name}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              restaurant.is_open 
                                ? 'bg-accent/20 text-accent' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {restaurant.is_open ? 'Open' : 'Closed'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{restaurant.cuisine_type} • {restaurant.category}</p>
                          {restaurant.lat && restaurant.lng && (
                            <div className="flex items-center gap-1 text-xs text-accent mt-1">
                              <MapPin className="w-3 h-3" />
                              <span>Location set</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={restaurant.is_verified}
                            onCheckedChange={(checked) => toggleVerification(restaurant.id, checked)}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                        <Input
                          type="number"
                          placeholder={`${restaurant.commission_rate}%`}
                          value={commissionUpdates[restaurant.id] || ''}
                          onChange={(e) => setCommissionUpdates((prev) => ({
                            ...prev,
                            [restaurant.id]: e.target.value,
                          }))}
                          className="w-20 h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCommission(restaurant.id)}
                          disabled={!commissionUpdates[restaurant.id]}
                          className="h-8"
                        >
                          <Percent className="w-3 h-3 mr-1" />
                          Set
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Current: {restaurant.commission_rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Active Orders */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5 text-status-confirmed" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-3">
                  {orders.map((order) => (
                    <div 
                      key={order.id} 
                      className="p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">#{order.id.slice(0, 8)}</span>
                            <StatusBadge status={order.status as OrderStatus} />
                          </div>
                          <p className="text-sm mt-1">{order.restaurants?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">₹{Number(order.total_amount).toFixed(0)}</p>
                          {!['delivered', 'cancelled'].includes(order.status) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive mt-1">
                                  <X className="w-3 h-3 mr-1" />
                                  Cancel
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
                                    onClick={() => cancelOrder(order.id)}
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
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Delivery Partners */}
          <Card className="border-0 shadow-lg lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bike className="w-5 h-5 text-status-preparing" />
                Delivery Partners ({deliveryPartners.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {deliveryPartners.map((partner) => (
                  <div 
                    key={partner.id}
                    className="p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        partner.is_available ? 'bg-accent/20' : 'bg-muted'
                      }`}>
                        <Bike className={`w-5 h-5 ${partner.is_available ? 'text-accent' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Partner #{partner.id.slice(0, 6)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            partner.is_available 
                              ? 'bg-accent/20 text-accent' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {partner.is_available ? 'Online' : 'Offline'}
                          </span>
                          {partner.vehicle_type && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {partner.vehicle_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {partner.current_lat && partner.current_lng && (
                      <div className="flex items-center gap-1 text-xs text-accent mt-2">
                        <MapPin className="w-3 h-3" />
                        <span>{partner.current_lat.toFixed(3)}, {partner.current_lng.toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                ))}
                {deliveryPartners.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    <Bike className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No delivery partners registered yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
