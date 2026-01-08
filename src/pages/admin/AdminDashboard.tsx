import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Restaurant, Order, OrderStatus, DeliveryPartner, AppRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/StatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Users,
  UserPlus,
  Sparkles,
  Tag,
  RefreshCw,
  Search,
  Phone,
  IndianRupee,
  Filter
} from 'lucide-react';
import { PromotionsManager } from '@/components/admin/PromotionsManager';
import { CouponsManager } from '@/components/admin/CouponsManager';
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

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  roles: AppRole[];
}

export default function AdminDashboard() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<RestaurantWithStats[]>([]);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerWithProfile[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    verifiedRestaurants: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeOrders: 0,
    totalPartners: 0,
    totalUsers: 0,
    deliveryFeeEarnings: 0,
    platformFeeEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commissionUpdates, setCommissionUpdates] = useState<Record<string, string>>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});
  const [searchShops, setSearchShops] = useState('');
  const [searchOrders, setSearchOrders] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    const [restaurantsRes, ordersRes, partnersRes, profilesRes] = await Promise.all([
      supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, restaurants(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('delivery_partners').select('*'),
      supabase.from('profiles').select('id, email, full_name').order('created_at', { ascending: false }).limit(100),
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
      // Calculate delivery fee and platform fee earnings (from delivered orders only)
      const deliveredOrders = ordersRes.data.filter(o => o.status === 'delivered');
      const deliveryFeeEarnings = deliveredOrders.reduce(
        (sum, order) => sum + Number(order.delivery_fee || 25),
        0
      );
      const platformFee = 8; // Fixed platform fee per order
      const platformFeeEarnings = deliveredOrders.length * platformFee;
      setStats((prev) => ({
        ...prev,
        totalOrders: ordersRes.data.length,
        totalRevenue,
        activeOrders,
        deliveryFeeEarnings,
        platformFeeEarnings,
      }));
    }

    if (partnersRes.data) {
      setDeliveryPartners(partnersRes.data);
      setStats((prev) => ({
        ...prev,
        totalPartners: partnersRes.data.length,
      }));
    }

    // Fetch users with their roles
    if (profilesRes.data) {
      const userIds = profilesRes.data.map(p => p.id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const usersWithRoles: UserWithRoles[] = profilesRes.data.map(profile => ({
        ...profile,
        roles: rolesData?.filter(r => r.user_id === profile.id).map(r => r.role as AppRole) || []
      }));

      setUsers(usersWithRoles);
      setStats((prev) => ({
        ...prev,
        totalUsers: profilesRes.data.length,
      }));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

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
  }, [user, authLoading, hasRole, fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filtered data
  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchShops.toLowerCase()) ||
    (r.cuisine_type?.toLowerCase().includes(searchShops.toLowerCase()))
  );

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchOrders.toLowerCase()) ||
      (o.restaurants?.name?.toLowerCase().includes(searchOrders.toLowerCase()));
    const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter(u =>
    (u.full_name?.toLowerCase().includes(searchUsers.toLowerCase())) ||
    u.email.toLowerCase().includes(searchUsers.toLowerCase())
  );

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

  const addRoleToUser = async (userId: string) => {
    const role = selectedRole[userId];
    if (!role) {
      toast.error('Please select a role');
      return;
    }

    // Check if user already has this role
    const userRoles = users.find(u => u.id === userId)?.roles || [];
    if (userRoles.includes(role)) {
      toast.error('User already has this role');
      return;
    }

    // Use secure admin RPC function
    const { data, error } = await supabase.rpc('admin_assign_role', {
      _target_user_id: userId,
      _role: role
    });

    if (error || !data) {
      toast.error('Failed to add role');
    } else {
      toast.success(`Role ${role} added successfully`);
      setSelectedRole(prev => ({ ...prev, [userId]: '' as AppRole }));
      fetchData();
    }
  };

  const removeRoleFromUser = async (userId: string, role: AppRole) => {
    // Use secure admin RPC function
    const { data, error } = await supabase.rpc('admin_remove_role', {
      _target_user_id: userId,
      _role: role
    });

    if (error || !data) {
      toast.error('Failed to remove role');
    } else {
      toast.success(`Role ${role} removed`);
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
          <div className="flex items-center justify-between">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-9 w-9"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
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

          <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 to-accent/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Bike className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Delivery Fee</p>
                  <p className="text-2xl font-bold text-primary">₹{stats.deliveryFeeEarnings.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-accent/10 to-status-confirmed/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Platform Fee</p>
                  <p className="text-2xl font-bold text-accent">₹{stats.platformFeeEarnings.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-status-preparing/5 to-status-preparing/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-status-preparing/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-status-preparing" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Partners</p>
                  <p className="text-2xl font-bold text-status-preparing">{stats.totalPartners}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="shops" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="shops" className="gap-1 text-xs">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Shops</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1 text-xs">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="partners" className="gap-1 text-xs">
              <Bike className="w-4 h-4" />
              <span className="hidden sm:inline">Partners</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1 text-xs">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="promotions" className="gap-1 text-xs">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Promos</span>
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-1 text-xs">
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">Coupons</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shops">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Store className="w-5 h-5 text-primary" />
                    Shop Management ({filteredRestaurants.length})
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search shops..."
                      value={searchShops}
                      onChange={(e) => setSearchShops(e.target.value)}
                      className="pl-9 h-9 w-full sm:w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-4 space-y-3">
                    {filteredRestaurants.map((restaurant) => (
                      <div
                        key={restaurant.id}
                        className="p-3 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold truncate">{restaurant.name}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${restaurant.is_open
                                ? 'bg-accent/20 text-accent'
                                : 'bg-muted text-muted-foreground'
                                }`}>
                                {restaurant.is_open ? 'Open' : 'Closed'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{restaurant.cuisine_type}</p>
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
          </TabsContent>

          <TabsContent value="orders">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5 text-status-confirmed" />
                    Orders ({filteredOrders.length})
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search orders..."
                        value={searchOrders}
                        onChange={(e) => setSearchOrders(e.target.value)}
                        className="pl-9 h-9 w-full sm:w-48"
                      />
                    </div>
                    <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                      <SelectTrigger className="h-9 w-full sm:w-36">
                        <Filter className="w-3.5 h-3.5 mr-1" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="preparing">Preparing</SelectItem>
                        <SelectItem value="ready_for_pickup">Ready</SelectItem>
                        <SelectItem value="picked_up">Picked Up</SelectItem>
                        <SelectItem value="on_the_way">On The Way</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-4 space-y-3">
                    {filteredOrders.map((order) => (
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
          </TabsContent>

          <TabsContent value="partners">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bike className="w-5 h-5 text-status-preparing" />
                  Delivery Partners ({deliveryPartners.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {deliveryPartners.map((partner) => (
                    <div
                      key={partner.id}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${partner.is_available ? 'bg-accent/20' : 'bg-muted'
                          }`}>
                          <Bike className={`w-6 h-6 ${partner.is_available ? 'text-accent' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Partner #{partner.id.slice(0, 6)}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${partner.is_available
                              ? 'bg-accent/20 text-accent'
                              : 'bg-muted text-muted-foreground'
                              }`}>
                              {partner.is_available ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          {partner.phone && (
                            <a
                              href={`tel:${partner.phone}`}
                              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                            >
                              <Phone className="w-3 h-3" />
                              {partner.phone}
                            </a>
                          )}
                          {partner.vehicle_type && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Bike className="w-3 h-3" />
                              {partner.vehicle_type}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined: {format(new Date(partner.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
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
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-primary" />
                    User Role Management ({filteredUsers.length})
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchUsers}
                      onChange={(e) => setSearchUsers(e.target.value)}
                      className="pl-9 h-9 w-full sm:w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="p-4 space-y-3">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold">{u.full_name || 'No Name'}</h4>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {u.roles.map((role) => (
                                <span
                                  key={role}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                                >
                                  {role}
                                  <button
                                    onClick={() => removeRoleFromUser(u.id, role)}
                                    className="hover:text-destructive"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                              {u.roles.length === 0 && (
                                <span className="text-xs text-muted-foreground">No roles assigned</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                          <Select
                            value={selectedRole[u.id] || ''}
                            onValueChange={(value) => setSelectedRole(prev => ({ ...prev, [u.id]: value as AppRole }))}
                          >
                            <SelectTrigger className="w-40 h-8">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                              <SelectItem value="restaurant_owner">Restaurant Owner</SelectItem>
                              <SelectItem value="delivery_partner">Delivery Partner</SelectItem>
                              <SelectItem value="customer">Customer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => addRoleToUser(u.id)}
                            disabled={!selectedRole[u.id]}
                            className="h-8"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Add Role
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promotions">
            <PromotionsManager />
          </TabsContent>

          <TabsContent value="coupons">
            <CouponsManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
