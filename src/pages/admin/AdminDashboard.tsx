
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { GlobalLoading } from '@/components/ui/GlobalLoading';
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
  Filter,
  Settings,
  ShoppingBag,
  Wallet,
  FileText,
  MessageSquare,
  Star
} from 'lucide-react';
import { PromotionsManager } from '@/components/admin/PromotionsManager';
import { CouponsManager } from '@/components/admin/CouponsManager';
import { SettlementsManager } from '@/components/admin/SettlementsManager';
import { ShopSettlementsManager } from '@/components/admin/ShopSettlementsManager';
import { DeliveryPincodesManager } from '@/components/admin/DeliveryPincodesManager';
import { ScheduleSettings } from '@/components/admin/ScheduleSettings';
import { AdminOrderCard } from '@/components/admin/AdminOrderCard';
import { FinancialAnalytics } from '@/components/admin/FinancialAnalytics';
import { ReportsAnalytics } from '@/components/admin/ReportsAnalytics';
import { AdminSupport } from '@/components/admin/AdminSupport';
import {
  Bell,
  toast
} from 'sonner';
import { format } from 'date-fns';

interface RestaurantWithStats extends Restaurant {
  orders_count?: number;
}

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
  user_id: string;
  verification_otp?: string | null;
  phone_verified?: boolean;
  profiles?: {
    full_name: string | null;
    email: string;
    phone: string | null;
  };
  stats?: {
    total_deliveries: number;
    success_rate: number;
    cancelled: number;
    avg_rating: number | null;
  };
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
  const [enablePhoneLogin, setEnablePhoneLogin] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState('30');
  const [settlementPercent, setSettlementPercent] = useState('20');

  const fetchData = useCallback(async () => {
    const [restaurantsRes, ordersRes, partnersRes, profilesRes, settingsRes] = await Promise.all([
      supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, restaurants(name, address, phone), order_items(quantity, menu_item_id, menu_items(name, price))')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('delivery_partners').select('*'),
      supabase.from('profiles').select('id, email, full_name, phone').order('created_at', { ascending: false }).limit(200),
      supabase.from('app_settings').select('*'),
    ]);

    if (restaurantsRes.data) {
      setRestaurants(restaurantsRes.data);
      setStats((prev) => ({
        ...prev,
        totalRestaurants: restaurantsRes.data.length,
        verifiedRestaurants: restaurantsRes.data.filter((r) => r.is_verified).length,
      }));
    }

    if (partnersRes.data) {
      // Fetch profiles
      const partnerUserIds = partnersRes.data.map(p => p.user_id);
      const { data: partnerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', partnerUserIds);

      // Fetch stats (all orders/ratings)
      const { data: allOrderStats } = await supabase
        .from('orders')
        .select('id, status, delivery_partner_id');
      const { data: allRatings } = await supabase
        .from('order_ratings')
        .select('rating, delivery_partner_id');

      const partnersWithData = partnersRes.data.map(partner => {
        // Profile
        const profile = partnerProfiles?.find(p => p.id === partner.user_id) || undefined;

        // Stats
        const pOrders = allOrderStats?.filter(o => o.delivery_partner_id === partner.id) || [];
        const pDelivered = pOrders.filter(o => o.status === 'delivered');
        const pCancelled = pOrders.filter(o => o.status === 'cancelled');
        const pRatings = allRatings?.filter(r => r.delivery_partner_id === partner.id) || [];
        const avgRating = pRatings.length > 0
          ? pRatings.reduce((sum, r) => sum + r.rating, 0) / pRatings.length
          : null;

        return {
          ...partner,
          profiles: profile,
          stats: {
            total_deliveries: pDelivered.length,
            success_rate: pOrders.length > 0 ? Math.round((pDelivered.length / pOrders.length) * 100) : 0,
            cancelled: pCancelled.length,
            avg_rating: avgRating
          }
        };
      });

      setDeliveryPartners(partnersWithData);
      setStats((prev) => ({
        ...prev,
        totalPartners: partnersRes.data.length,
      }));
    }

    if (ordersRes.data) {
      // Manually join customer profiles to orders since DB join is not available via FK
      const enrichedOrders = ordersRes.data.map(order => {
        const customerProfile = profilesRes.data?.find(p => p.id === order.customer_id);
        return {
          ...order,
          customer_profile: customerProfile ? { full_name: customerProfile.full_name, phone: customerProfile.phone } : null
        };
      });
      setOrders(enrichedOrders);
      const activeOrders = ordersRes.data.filter(o =>
        !['delivered', 'cancelled'].includes(o.status)
      ).length;
      const totalRevenue = ordersRes.data
        .filter(o => o.status === 'delivered')
        .reduce((sum, order) => sum + Number(order.total_amount), 0);

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

    if (settingsRes.data) {
      settingsRes.data.forEach(setting => {
        if (setting.key === 'enable_phone_login') {
          setEnablePhoneLogin(setting.value as boolean);
        } else if (setting.key === 'delivery_fee_per_order') {
          setDeliveryFee(String(setting.value));
        } else if (setting.key === 'pending_settlement_percentage') {
          setSettlementPercent(String(setting.value));
        }
      });
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const subscribeToChanges = useCallback(() => {
    const channel = supabase
      .channel('admin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

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
  }, [user, authLoading, hasRole, fetchData, subscribeToChanges, navigate]);

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

  const updateSetting = async (key: string, value: any) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value });

    if (error) {
      toast.error('Failed to update settings');
    } else {
      if (key === 'enable_phone_login') setEnablePhoneLogin(value);
      toast.success('Settings updated');
      fetchData(); // Refresh to ensure sync
    }
  };

  if (authLoading || loading) {
    return <GlobalLoading message="Loading admin dashboard..." />;
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 hidden md:flex items-center justify-center shadow-lg">
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
            <div className="flex items-center gap-2">
              <Link to="/admin/support">
                <Button variant="outline" size="sm" className="hidden md:flex gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Support
                </Button>
              </Link>
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
          <TabsList className="flex flex-wrap h-auto gap-2 p-2 bg-muted/50">
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
            <TabsTrigger value="settlements" className="gap-2 text-xs">
              <IndianRupee className="w-4 h-4" />
              <span className="hidden sm:inline">Settlements</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 text-xs">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-2 text-xs">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Financials</span>
            </TabsTrigger>
            <TabsTrigger value="delivery-areas" className="gap-1 text-xs">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Areas</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 text-xs">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
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

                        <div className="mt-4 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Commission Rate</span>
                            <span className="text-xs font-bold bg-secondary px-2 py-0.5 rounded text-secondary-foreground">
                              {restaurant.commission_rate}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Input
                                type="number"
                                placeholder="New rate"
                                value={commissionUpdates[restaurant.id] || ''}
                                onChange={(e) => setCommissionUpdates((prev) => ({
                                  ...prev,
                                  [restaurant.id]: e.target.value,
                                }))}
                                className="h-8 text-sm pr-6"
                                min="0"
                                max="100"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => updateCommission(restaurant.id)}
                              disabled={!commissionUpdates[restaurant.id]}
                              className="h-8"
                            >
                              Set
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivery-areas">
            <DeliveryPincodesManager />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsAnalytics />
          </TabsContent>

          <TabsContent value="financials">
            <FinancialAnalytics />
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
                      <AdminOrderCard
                        key={order.id}
                        order={order}
                        deliveryPartners={deliveryPartners}
                        onCancel={cancelOrder}
                      />
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
                            <p className="text-sm font-semibold">
                              {partner.profiles?.full_name || partner.profiles?.email || `Partner #${partner.id.slice(0, 6)}`}
                            </p>
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
                          {!partner.phone_verified && partner.verification_otp && (
                            <p className="text-xs font-bold text-orange-500 mt-1 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              OTP: {partner.verification_otp}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined: {format(new Date(partner.created_at), 'MMM d, yyyy')}
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
                            <div className="text-center p-1.5 bg-secondary/30 rounded">
                              <p className="text-[10px] text-muted-foreground uppercase">Deliveries</p>
                              <p className="font-bold text-sm">{partner.stats?.total_deliveries || 0}</p>
                            </div>
                            <div className="text-center p-1.5 bg-secondary/30 rounded">
                              <p className="text-[10px] text-muted-foreground uppercase">Success</p>
                              <p className="font-bold text-sm text-accent">{partner.stats?.success_rate || 0}%</p>
                            </div>
                            <div className="text-center p-1.5 bg-secondary/30 rounded">
                              <p className="text-[10px] text-muted-foreground uppercase">Cancelled</p>
                              <p className="font-bold text-sm text-destructive">{partner.stats?.cancelled || 0}</p>
                            </div>
                            <div className="text-center p-1.5 bg-secondary/30 rounded">
                              <p className="text-[10px] text-muted-foreground uppercase">Rating</p>
                              <div className="flex items-center justify-center gap-0.5 font-bold text-sm">
                                <span>{partner.stats?.avg_rating?.toFixed(1) || '—'}</span>
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              </div>
                            </div>
                          </div>

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
                              <SelectItem value="support_agent">Support Agent</SelectItem>
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

          <TabsContent value="settlements">
            <Tabs defaultValue="partners" className="w-full">
              <div className="flex items-center gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="partners" className="flex items-center gap-2">
                    <Bike className="h-4 w-4" />
                    Delivery Partners
                  </TabsTrigger>
                  <TabsTrigger value="shops" className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Restaurants
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="partners" className="m-0">
                <SettlementsManager />
              </TabsContent>
              <TabsContent value="shops" className="m-0">
                <ShopSettlementsManager />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="settings">
            <ScheduleSettings />

            {/* Keeping existing settings in a separate card below if needed, or we can merge them into ScheduleSettings later.
                For now, let's keep the existing "System Settings" card below the Schedule Settings so we don't lose that functionality (Phone Login, Delivery Fee etc)
                Actually, the user asked for "Schedule... time fix to admin", so I should prioritize the schedule settings.
                I'll render the new component first.
            */}

            <div className="mt-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5 text-primary" />
                    General Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                    <div className="space-y-0.5">
                      <h4 className="font-semibold text-base">Phone Login</h4>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable phone number authentication.
                      </p>
                    </div>
                    <Switch
                      checked={enablePhoneLogin}
                      onCheckedChange={(checked) => updateSetting('enable_phone_login', checked)}
                    />
                  </div>

                  <div className="p-4 border rounded-xl bg-card space-y-4">
                    <h4 className="font-semibold text-base">Settlement Configuration</h4>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Delivery Fee per Order (₹)</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={deliveryFee}
                            onChange={(e) => setDeliveryFee(e.target.value)}
                            placeholder="30"
                          />
                          <Button
                            variant="secondary"
                            onClick={() => updateSetting('delivery_fee_per_order', Number(deliveryFee))}
                          >
                            Save
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Amount paid to partner per delivery.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Pending Settlement (%)</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={settlementPercent}
                            onChange={(e) => setSettlementPercent(e.target.value)}
                            placeholder="20"
                          />
                          <Button
                            variant="secondary"
                            onClick={() => updateSetting('pending_settlement_percentage', Number(settlementPercent))}
                          >
                            Save
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Percentage of earnings held for later settlement.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
