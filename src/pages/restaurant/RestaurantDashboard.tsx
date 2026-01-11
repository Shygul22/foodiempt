import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { GlobalLoading } from '@/components/ui/GlobalLoading';
import { Restaurant, MenuItem, Order, OrderStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MenuImageUpload } from '@/components/MenuImageUpload';
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
  Store,
  ArrowLeft,
  Plus,
  Package,
  Clock,
  Edit,
  Trash2,
  Key,
  Banknote,
  Smartphone,
  User,
  Phone,
  XCircle,
  History,
  TrendingUp,
  IndianRupee,
  Wallet,
  MapPin,
  Navigation,
  Loader2,
  Settings,
  RefreshCw,
  Search,
  Bike,
  Percent,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useRestaurantOrderNotifications } from '@/hooks/useOrderNotifications';
import { RestaurantDeliveryPincodesManager } from '@/components/restaurant/RestaurantDeliveryPincodesManager';

interface OrderWithItems extends Order {
  order_items: { quantity: number; unit_price: number; menu_items: { name: string } | null }[];
  customer_profile?: { full_name: string | null; phone: string | null } | null;
  delivery_partner_profile?: { full_name: string | null; phone: string | null } | null;
}

// Helper to generate short order ID
const getShortOrderId = (id: string) => {
  return `#${id.slice(0, 8).toUpperCase()}`;
};

export default function RestaurantDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderWithItems[]>([]);
  const [earnings, setEarnings] = useState({
    today: 0, week: 0, total: 0, orderCount: 0,
    grossToday: 0, grossWeek: 0, grossTotal: 0,
    deliveryFees: 0, platformFees: 0, commission: 0,
    pendingBalance: 0 // New field
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateRestaurant, setShowCreateRestaurant] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [searchOrders, setSearchOrders] = useState('');
  const [searchMenu, setSearchMenu] = useState('');

  // Form states
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    cuisine_type: '',
    image_url: '',
    lat: '',
    lng: '',
    pincode: '',
    locality: '',
  });
  const [detectingLocation, setDetectingLocation] = useState(false);

  const [menuItemForm, setMenuItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
  });

  // ... (existing state)

  const fetchData = useCallback(async () => {
    // Fetch restaurant owned by user
    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user!.id)
      .maybeSingle();

    if (restaurantData) {
      setRestaurant(restaurantData as unknown as Restaurant);

      // Fetch menu items...
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .order('category', { ascending: true });

      if (menuData) setMenuItems(menuData);

      // Fetch active orders...
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, order_items(quantity, unit_price, menu_items(name))')
        .eq('restaurant_id', restaurantData.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'])
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch order history...
      const { data: historyData } = await supabase
        .from('orders')
        .select('*, order_items(quantity, unit_price, menu_items(name))')
        .eq('restaurant_id', restaurantData.id)
        .in('status', ['delivered', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch settlements for this restaurant
      const { data: settlementsData } = await supabase
        .from('settlements')
        .select('amount')
        .eq('restaurant_id', restaurantData.id);

      const allOrders = [...(ordersData || []), ...(historyData || [])];
      // ... (profile processing remains same)
      const customerIds = allOrders.map(o => o.customer_id);
      const deliveryPartnerIds = allOrders.map(o => o.delivery_partner_id).filter(Boolean) as string[];
      const profileIds = [...new Set([...customerIds, ...deliveryPartnerIds])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', profileIds);


      if (ordersData) {
        const ordersWithProfiles = ordersData.map(order => ({
          ...order,
          customer_profile: profiles?.find(p => p.id === order.customer_id) || null,
          delivery_partner_profile: profiles?.find(p => p.id === order.delivery_partner_id) || null
        }));
        setOrders(ordersWithProfiles as OrderWithItems[]);
      }

      if (historyData) {
        const historyWithProfiles = historyData.map(order => ({
          ...order,
          customer_profile: profiles?.find(p => p.id === order.customer_id) || null,
          delivery_partner_profile: profiles?.find(p => p.id === order.delivery_partner_id) || null
        }));
        setOrderHistory(historyWithProfiles as OrderWithItems[]);

        // Calculate earnings
        const deliveredOrders = historyData.filter(o => o.status === 'delivered');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const platformFee = 8;
        const deliveryFee = 25;
        const commissionRate = restaurantData.commission_rate || 15;

        const calculateShopEarnings = (order: OrderWithItems) => {
          const orderDeliveryFee = Number(order.delivery_fee || deliveryFee);
          const subtotal = Number(order.total_amount) - orderDeliveryFee - platformFee;
          const commission = (subtotal * commissionRate) / 100;
          return Math.max(0, subtotal - commission);
        };

        const todayOrders = deliveredOrders.filter(o => new Date(o.created_at) >= today);
        const weekOrders = deliveredOrders.filter(o => new Date(o.created_at) >= weekAgo);

        const grossToday = todayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const grossWeek = weekOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const grossTotal = deliveredOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

        const todayShopEarnings = todayOrders.reduce((sum, o) => sum + calculateShopEarnings(o), 0);
        const weekShopEarnings = weekOrders.reduce((sum, o) => sum + calculateShopEarnings(o), 0);
        const totalShopEarnings = deliveredOrders.reduce((sum, o) => sum + calculateShopEarnings(o), 0);

        const totalDeliveryFees = deliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee || deliveryFee), 0);
        const totalPlatformFees = deliveredOrders.length * platformFee;
        const totalCommission = deliveredOrders.reduce((sum, o) => {
          const orderDeliveryFee = Number(o.delivery_fee || deliveryFee);
          const subtotal = Number(o.total_amount) - orderDeliveryFee - platformFee;
          return sum + (subtotal * commissionRate) / 100;
        }, 0);

        // Calculate Settlements
        const totalSettled = (settlementsData || []).reduce((sum, s) => sum + Number(s.amount), 0);
        const pendingBalance = Math.max(0, totalShopEarnings - totalSettled);

        setEarnings({
          today: todayShopEarnings,
          week: weekShopEarnings,
          total: totalShopEarnings,
          orderCount: deliveredOrders.length,
          grossToday,
          grossWeek,
          grossTotal,
          deliveryFees: totalDeliveryFees,
          platformFees: totalPlatformFees,
          commission: totalCommission,
          pendingBalance
        });
      }
    } else {
      setShowCreateRestaurant(true);
    }

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  const subscribeToOrders = useCallback(() => {
    const channel = supabase
      .channel('restaurant-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settlements',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, navigate, fetchData]);

  useEffect(() => {
    if (restaurant?.id) {
      subscribeToOrders();
    }
  }, [restaurant?.id, subscribeToOrders]);

  // Sound notifications for new orders
  useRestaurantOrderNotifications(restaurant?.id);



  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filtered data
  const filteredOrders = orders.filter(o =>
    o.id.toLowerCase().includes(searchOrders.toLowerCase()) ||
    (o.customer_profile?.full_name?.toLowerCase().includes(searchOrders.toLowerCase()))
  );

  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchMenu.toLowerCase()) ||
    (item.category?.toLowerCase().includes(searchMenu.toLowerCase()))
  );



  const createRestaurant = async () => {
    if (!restaurantForm.name || !restaurantForm.address) {
      toast.error('Name and address are required');
      return;
    }

    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        owner_id: user!.id,
        name: restaurantForm.name,
        description: restaurantForm.description || null,
        address: restaurantForm.address,
        phone: restaurantForm.phone || null,
        cuisine_type: restaurantForm.cuisine_type || null,
        image_url: restaurantForm.image_url || null,
        lat: restaurantForm.lat ? parseFloat(restaurantForm.lat) : null,
        lng: restaurantForm.lng ? parseFloat(restaurantForm.lng) : null,
        pincode: restaurantForm.pincode || null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      // Use secure RPC to assign restaurant_owner role
      await supabase.rpc('request_restaurant_owner_role');

      setRestaurant(data as unknown as Restaurant);
      setShowCreateRestaurant(false);
      toast.success('Shop created! Awaiting admin verification.');
    }
  };

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRestaurantForm(prev => ({
          ...prev,
          lat: position.coords.latitude.toString(),
          lng: position.coords.longitude.toString(),
        }));
        setDetectingLocation(false);
        toast.success('Location detected!');
      },
      (error) => {
        setDetectingLocation(false);
        toast.error('Failed to get location: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const updateShopLocation = async () => {
    if (!restaurant) return;

    const { error } = await supabase
      .from('restaurants')
      .update({
        lat: restaurantForm.lat ? parseFloat(restaurantForm.lat) : null,
        lng: restaurantForm.lng ? parseFloat(restaurantForm.lng) : null,
        pincode: restaurantForm.pincode || null,
        locality: restaurantForm.locality || null,
      })
      .eq('id', restaurant.id);

    if (error) {
      toast.error('Failed to update location');
    } else {
      setRestaurant(prev => prev ? {
        ...prev,
        lat: restaurantForm.lat ? parseFloat(restaurantForm.lat) : null,
        lng: restaurantForm.lng ? parseFloat(restaurantForm.lng) : null,
        pincode: restaurantForm.pincode || null,
        locality: restaurantForm.locality || null,
      } : null);
      toast.success('Shop details updated!');
    }
  };

  const toggleShopStatus = async () => {
    if (!restaurant) return;

    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: !restaurant.is_open })
      .eq('id', restaurant.id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      setRestaurant({ ...restaurant, is_open: !restaurant.is_open });
      toast.success(restaurant.is_open ? 'Shop closed' : 'Shop opened');
    }
  };

  const addMenuItem = async () => {
    if (!menuItemForm.name || !menuItemForm.price) {
      toast.error('Name and price are required');
      return;
    }

    const { error } = await supabase.from('menu_items').insert({
      restaurant_id: restaurant!.id,
      name: menuItemForm.name,
      description: menuItemForm.description || null,
      price: parseFloat(menuItemForm.price),
      category: menuItemForm.category || null,
      image_url: menuItemForm.image_url || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      setMenuItemForm({ name: '', description: '', price: '', category: '', image_url: '' });
      setShowAddItem(false);
      fetchData();
      toast.success('Menu item added');
    }
  };

  const updateMenuItem = async () => {
    if (!editingItem) return;

    const { error } = await supabase
      .from('menu_items')
      .update({
        name: menuItemForm.name,
        description: menuItemForm.description || null,
        price: parseFloat(menuItemForm.price),
        category: menuItemForm.category || null,
        image_url: menuItemForm.image_url || null,
      })
      .eq('id', editingItem.id);

    if (error) {
      toast.error(error.message);
    } else {
      setEditingItem(null);
      setMenuItemForm({ name: '', description: '', price: '', category: '', image_url: '' });
      fetchData();
      toast.success('Menu item updated');
    }
  };

  const deleteMenuItem = async (id: string) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      fetchData();
      toast.success('Menu item deleted');
    }
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);

    if (!error) {
      fetchData();
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update order');
    } else {
      fetchData();
      toast.success('Order status updated');
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
      fetchData();
      toast.success('Order cancelled');
    }
  };

  if (loading) {
    return <GlobalLoading message="Loading dashboard..." />;
  }

  // Show create restaurant form
  if (showCreateRestaurant) {
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
        <div className="container mx-auto px-4 py-8 max-w-xl">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Register Your Shop
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Shop Name *</Label>
                <Input
                  value={restaurantForm.name}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                  placeholder="My Shop"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={restaurantForm.description}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, description: e.target.value })}
                  placeholder="Tell customers about your shop..."
                />
              </div>
              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  value={restaurantForm.address}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })}
                  placeholder="123 Main St, City"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={restaurantForm.phone}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })}
                    placeholder="+91 1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={restaurantForm.cuisine_type}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, cuisine_type: e.target.value })}
                    placeholder="Food, Grocery..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <Input
                    value={restaurantForm.image_url}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pincode *</Label>
                  <Input
                    value={restaurantForm.pincode}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, pincode: e.target.value })}
                    placeholder="560001"
                  />
                </div>
              </div>

              {/* Location Section */}
              <div className="space-y-3 p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Shop Location
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={detectCurrentLocation}
                    disabled={detectingLocation}
                    className="gap-1"
                  >
                    {detectingLocation ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    Detect
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={restaurantForm.lat}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, lat: e.target.value })}
                      placeholder="12.9716"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={restaurantForm.lng}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, lng: e.target.value })}
                      placeholder="77.5946"
                    />
                  </div>
                </div>
                {restaurantForm.lat && restaurantForm.lng && (
                  <p className="text-xs text-accent flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Location set successfully
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Location helps customers find your shop and calculate delivery distance
                </p>
              </div>

              <Button className="w-full" onClick={createRestaurant}>
                Register Shop
              </Button>
            </CardContent>
          </Card>
        </div>
      </div >
    );
  }

  const pendingOrders = orders.filter((o) => ['pending', 'confirmed', 'preparing', 'ready_for_pickup'].includes(o.status));

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
                <Store className="w-5 h-5 text-primary hidden md:block" />
                <h1 className="text-xl font-bold">{restaurant?.name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/support">
                <Button variant="outline" size="sm" className="hidden md:flex gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Support
                </Button>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <MessageSquare className="w-5 h-5" />
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
              {!restaurant?.is_verified && (
                <span className="text-sm text-status-pending">Pending Verification</span>
              )}
              <div className="flex items-center gap-2">
                <span className={`text-sm ${restaurant?.is_open ? 'text-accent' : 'text-muted-foreground'}`}>
                  {restaurant?.is_open ? 'Open' : 'Closed'}
                </span>
                <Switch
                  checked={restaurant?.is_open || false}
                  onCheckedChange={toggleShopStatus}
                  disabled={!restaurant?.is_verified}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="orders" className="relative gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Orders</span>
              {pendingOrders.length > 0 && (
                <span className="w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {pendingOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="menu" className="gap-2">
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Menu</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-2">
              <Banknote className="w-4 h-4" />
              <span className="hidden sm:inline">Financials</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID or customer..."
                value={searchOrders}
                onChange={(e) => setSearchOrders(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredOrders.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {searchOrders ? 'No orders found' : 'No active orders'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchOrders ? 'Try a different search term' : 'Orders will appear here when customers place them'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm bg-secondary px-1.5 py-0.5 rounded">
                              {getShortOrderId(order.id)}
                            </span>
                            <StatusBadge status={order.status as OrderStatus} />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-4 h-4" />
                            {format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        <p className="font-bold text-primary text-lg">₹{Number(order.total_amount).toFixed(2)}</p>
                      </div>

                      {/* Customer Info */}
                      <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg mb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{order.customer_profile?.full_name || 'Customer'}</span>
                        </div>
                        {order.customer_profile?.phone && (
                          <a
                            href={`tel:${order.customer_profile.phone}`}
                            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            Call
                          </a>
                        )}
                      </div>

                      {/* Delivery Address */}
                      {order.delivery_address && (
                        <p className="text-sm text-muted-foreground mb-3 truncate">
                          📍 {order.delivery_address}
                        </p>
                      )}

                      <div className="space-y-1 mb-3">
                        {order.order_items.map((item, idx) => (
                          <p key={idx} className="text-sm">
                            {item.quantity}x {item.menu_items?.name || 'Unknown'} - ₹{(Number(item.unit_price) * item.quantity).toFixed(2)}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="flex gap-2 flex-wrap">
                          {order.status === 'pending' && (
                            <>
                              <Button size="sm" onClick={() => updateOrderStatus(order.id, 'confirmed')}>
                                Accept
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, 'cancelled')}>
                                Reject
                              </Button>
                            </>
                          )}
                          {order.status === 'confirmed' && (
                            <>
                              <Button size="sm" onClick={() => updateOrderStatus(order.id, 'preparing')}>
                                Start Preparing
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-destructive">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to cancel this order? The customer will be notified.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => cancelOrder(order.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Yes, Cancel
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          {order.status === 'preparing' && (
                            <>
                              <Button size="sm" onClick={() => updateOrderStatus(order.id, 'ready_for_pickup')}>
                                Ready for Pickup
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-destructive">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This order is being prepared. Are you sure you want to cancel it?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => cancelOrder(order.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Yes, Cancel
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </div>


                      {/* Delivery Partner Info */}
                      {order.status !== 'pending' && order.status !== 'confirmed' && order.delivery_partner_profile && (
                        <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Bike className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-600">Delivery Partner</span>
                              </div>
                              <p className="text-sm font-bold mt-1 text-foreground">
                                {order.delivery_partner_profile.full_name || 'Assigned'}
                              </p>
                            </div>
                            {order.delivery_partner_profile.phone && (
                              <a
                                href={`tel:${order.delivery_partner_profile.phone}`}
                                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                              >
                                <Phone className="w-3 h-3" />
                                Call
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Show Pickup OTP when ready for pickup */}
                      {order.status === 'ready_for_pickup' && order.pickup_otp && (
                        <div className="mt-3 p-3 bg-accent/10 rounded-lg border border-accent/20">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium text-accent">Pickup OTP:</span>
                            <span className="font-mono font-bold text-lg text-accent tracking-widest">{order.pickup_otp}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">Share this code with the delivery partner for order handoff</span>
                        </div>
                      )}

                      {/* Payment method badge */}
                      <div className="flex items-center gap-2 mt-2">
                        {order.payment_method === 'cod' ? (
                          <span className="flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                            <Banknote className="w-3 h-3" /> Cash on Delivery
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            <Smartphone className="w-3 h-3" /> Google Pay
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Menu Items</h2>
              <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Menu Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={menuItemForm.name}
                        onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={menuItemForm.description}
                        onChange={(e) => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Price (₹) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={menuItemForm.price}
                          onChange={(e) => setMenuItemForm({ ...menuItemForm, price: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input
                          value={menuItemForm.category}
                          onChange={(e) => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                        />
                      </div>
                    </div>
                    <MenuImageUpload
                      currentImageUrl={menuItemForm.image_url}
                      onImageChange={(url) => setMenuItemForm({ ...menuItemForm, image_url: url })}
                      restaurantId={restaurant?.id || ''}
                    />
                    <Button className="w-full" onClick={addMenuItem}>Add Item</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search Menu */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={searchMenu}
                onChange={(e) => setSearchMenu(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredMenuItems.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <p className="text-muted-foreground">
                    {searchMenu ? 'No items found' : 'No menu items yet. Add your first item!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredMenuItems.map((item) => (
                  <Card key={item.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{item.name}</h3>
                            {!item.is_available && (
                              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Unavailable</span>
                            )}
                          </div>
                          {item.category && <p className="text-sm text-muted-foreground">{item.category}</p>}
                          <p className="text-primary font-bold">₹{Number(item.price).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_available}
                            onCheckedChange={() => toggleItemAvailability(item)}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingItem(item);
                              setMenuItemForm({
                                name: item.name,
                                description: item.description || '',
                                price: item.price.toString(),
                                category: item.category || '',
                                image_url: item.image_url || '',
                              });
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMenuItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Menu Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={menuItemForm.name}
                      onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={menuItemForm.description}
                      onChange={(e) => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Price (₹) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={menuItemForm.price}
                        onChange={(e) => setMenuItemForm({ ...menuItemForm, price: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input
                        value={menuItemForm.category}
                        onChange={(e) => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                      />
                    </div>
                  </div>
                  <MenuImageUpload
                    currentImageUrl={menuItemForm.image_url}
                    onImageChange={(url) => setMenuItemForm({ ...menuItemForm, image_url: url })}
                    restaurantId={restaurant?.id || ''}
                  />
                  <Button className="w-full" onClick={updateMenuItem}>Save Changes</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" />
              Order History
            </h2>
            {orderHistory.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <History className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No order history</h3>
                  <p className="text-muted-foreground">Completed orders will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {orderHistory.map((order) => (
                  <Card key={order.id} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm bg-secondary px-1.5 py-0.5 rounded">
                            {getShortOrderId(order.id)}
                          </span>
                          <StatusBadge status={order.status as OrderStatus} />
                        </div>
                        <p className="font-bold text-primary">₹{Number(order.total_amount).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                        <span>{order.customer_profile?.full_name || 'Customer'}</span>
                        <span>{format(new Date(order.created_at), 'MMM d, h:mm a')}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="space-y-6">


            <div className="grid md:grid-cols-2 gap-6">
              {/* Income Breakdown */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Transaction Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center p-2 bg-secondary/30 rounded-lg">
                      <span className="text-muted-foreground">Gross Sales (Total Value)</span>
                      <span className="font-bold">₹{earnings.grossTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2">
                      <span className="text-muted-foreground">Total Orders</span>
                      <span className="font-medium">{earnings.orderCount}</span>
                    </div>
                    <div className="flex justify-between items-center p-2">
                      <span className="text-muted-foreground">Avg. Order Value</span>
                      <span className="font-medium">
                        ₹{earnings.orderCount > 0 ? (earnings.grossTotal / earnings.orderCount).toFixed(0) : '0'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Balance Sheet */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Balance Sheet</CardTitle>
                  <p className="text-xs text-muted-foreground">Credits vs Debits</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-status-delivered">
                      <span>Total Credits (Gross)</span>
                      <span className="font-bold">+₹{earnings.grossTotal.toFixed(2)}</span>
                    </div>

                    <div className="border-t border-dashed border-border my-2"></div>

                    <div className="flex justify-between items-center text-status-cancelled">
                      <span>Platform Fees (Debit)</span>
                      <span>-₹{earnings.platformFees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-status-cancelled">
                      <span>Delivery Fees (Debit)</span>
                      <span>-₹{earnings.deliveryFees.toFixed(2)}</span>
                    </div>


                    <div className="border-t border-border my-2"></div>

                    <div className="flex justify-between items-center font-bold text-lg">
                      <span>Net Payout</span>
                      <span className="text-primary">₹{earnings.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <div className="flex justify-between items-center">
                      <span className="text-accent font-medium">Pending Release</span>
                      <span className="text-accent font-bold text-lg">₹{earnings.pendingBalance.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Delivery Areas Manager */}
            {restaurant?.id && (
              <RestaurantDeliveryPincodesManager restaurantId={restaurant.id} />
            )}

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Shop Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Shop Name</span>
                  <span className="font-medium">{restaurant?.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Address</span>
                  <span className="font-medium text-sm text-right max-w-[200px] truncate">{restaurant?.address}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Pincode</span>
                  <span className="font-medium">{restaurant?.pincode || 'Not Set'}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Locality</span>
                  <span className="font-medium">{restaurant?.locality || 'Not Set'}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Verification Status</span>
                  <span className={`font-medium ${restaurant?.is_verified ? 'text-accent' : 'text-status-pending'}`}>
                    {restaurant?.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2 mt-4" onClick={() => {
                      if (restaurant) {
                        setRestaurantForm({
                          name: restaurant.name,
                          description: restaurant.description || '',
                          address: restaurant.address,
                          phone: restaurant.phone || '',
                          cuisine_type: restaurant.cuisine_type || '',
                          image_url: restaurant.image_url || '',
                          lat: restaurant.lat?.toString() || '',
                          lng: restaurant.lng?.toString() || '',
                          pincode: restaurant.pincode || '',
                          locality: restaurant.locality || '',
                        });
                      }
                    }}>
                      <Edit className="w-4 h-4" />
                      Edit Shop Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Shop Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Pincode</Label>
                          <Input
                            placeholder="6-digit Pincode"
                            value={restaurantForm.pincode}
                            onChange={(e) => setRestaurantForm({ ...restaurantForm, pincode: e.target.value })}
                            maxLength={6}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Locality</Label>
                          <Input
                            placeholder="Locality Area"
                            value={restaurantForm.locality}
                            onChange={(e) => setRestaurantForm({ ...restaurantForm, locality: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Full Address</Label>
                        <Input
                          value={restaurantForm.address}
                          onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })}
                        />
                      </div>
                      <Button className="w-full" onClick={updateShopLocation}>
                        Save Shop Details
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
}
