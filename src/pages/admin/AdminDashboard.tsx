import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Restaurant, Order, OrderStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
  Shield, 
  Store, 
  Package, 
  DollarSign, 
  Users, 
  ArrowLeft,
  Check,
  X,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RestaurantWithStats extends Restaurant {
  orders_count?: number;
}

interface OrderWithDetails extends Order {
  restaurants: { name: string } | null;
}

export default function AdminDashboard() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    verifiedRestaurants: 0,
    totalOrders: 0,
    totalRevenue: 0,
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
    const [restaurantsRes, ordersRes] = await Promise.all([
      supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, restaurants(name)')
        .order('created_at', { ascending: false })
        .limit(50),
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
      const totalRevenue = ordersRes.data.reduce(
        (sum, order) => sum + Number(order.total_amount),
        0
      );
      setStats((prev) => ({
        ...prev,
        totalOrders: ordersRes.data.length,
        totalRevenue,
      }));
    }

    setLoading(false);
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('admin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, fetchData)
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shops</p>
                  <p className="text-2xl font-bold">{stats.totalRestaurants}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold">{stats.verifiedRestaurants}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-status-confirmed/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-status-confirmed" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Orders</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-status-delivered/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-status-delivered" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">₹{stats.totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="restaurants" className="space-y-6">
          <TabsList>
            <TabsTrigger value="restaurants">Shops</TabsTrigger>
            <TabsTrigger value="orders">All Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="restaurants" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  Shop Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Shop</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Verified</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Commission</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restaurants.map((restaurant) => (
                        <tr key={restaurant.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium">{restaurant.name}</p>
                              <p className="text-sm text-muted-foreground">{restaurant.cuisine_type}</p>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              restaurant.is_open 
                                ? 'bg-accent/10 text-accent' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {restaurant.is_open ? 'Open' : 'Closed'}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <Switch
                              checked={restaurant.is_verified}
                              onCheckedChange={(checked) => toggleVerification(restaurant.id, checked)}
                            />
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder={`${restaurant.commission_rate}%`}
                                value={commissionUpdates[restaurant.id] || ''}
                                onChange={(e) => setCommissionUpdates((prev) => ({
                                  ...prev,
                                  [restaurant.id]: e.target.value,
                                }))}
                                className="w-20 h-8"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateCommission(restaurant.id)}
                                disabled={!commissionUpdates[restaurant.id]}
                              >
                                <Percent className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-sm text-muted-foreground">
                              Current: {restaurant.commission_rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  All Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Order ID</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Restaurant</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Customer</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                          <td className="py-3 px-2 font-mono text-sm">
                            #{order.id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-2">{order.restaurants?.name || 'Unknown'}</td>
                          <td className="py-3 px-2">
                            <p className="font-mono text-sm">{order.customer_id.slice(0, 8)}...</p>
                          </td>
                          <td className="py-3 px-2">
                            <StatusBadge status={order.status as OrderStatus} />
                          </td>
                          <td className="py-3 px-2 font-medium">₹{Number(order.total_amount).toFixed(2)}</td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </td>
                          <td className="py-3 px-2">
                            {!['delivered', 'cancelled'].includes(order.status) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <X className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to cancel order #{order.id.slice(0, 8)}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>No, Keep Order</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => cancelOrder(order.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Yes, Cancel Order
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
