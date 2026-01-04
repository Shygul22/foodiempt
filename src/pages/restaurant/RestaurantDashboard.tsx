import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrderWithItems extends Order {
  order_items: { quantity: number; unit_price: number; menu_items: { name: string } | null }[];
  customer_profile?: { full_name: string | null; phone: string | null } | null;
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
  const [earnings, setEarnings] = useState({ today: 0, week: 0, total: 0, orderCount: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateRestaurant, setShowCreateRestaurant] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

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
  });
  const [detectingLocation, setDetectingLocation] = useState(false);

  const [menuItemForm, setMenuItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      fetchData();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (restaurant?.id) {
      subscribeToOrders();
    }
  }, [restaurant?.id]);

  const fetchData = async () => {
    // Fetch restaurant owned by user
    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('*')
      .eq('owner_id', user!.id)
      .maybeSingle();

    if (restaurantData) {
      setRestaurant(restaurantData);
      
      // Fetch menu items
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .order('category', { ascending: true });

      if (menuData) setMenuItems(menuData);

      // Fetch active orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, order_items(quantity, unit_price, menu_items(name))')
        .eq('restaurant_id', restaurantData.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'])
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch order history (delivered/cancelled)
      const { data: historyData } = await supabase
        .from('orders')
        .select('*, order_items(quantity, unit_price, menu_items(name))')
        .eq('restaurant_id', restaurantData.id)
        .in('status', ['delivered', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(50);

      const allOrders = [...(ordersData || []), ...(historyData || [])];
      const customerIds = allOrders.map(o => o.customer_id);
      const { data: customerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', customerIds);

      if (ordersData) {
        const ordersWithProfiles = ordersData.map(order => ({
          ...order,
          customer_profile: customerProfiles?.find(p => p.id === order.customer_id) || null
        }));
        setOrders(ordersWithProfiles as OrderWithItems[]);
      }

      if (historyData) {
        const historyWithProfiles = historyData.map(order => ({
          ...order,
          customer_profile: customerProfiles?.find(p => p.id === order.customer_id) || null
        }));
        setOrderHistory(historyWithProfiles as OrderWithItems[]);

        // Calculate earnings
        const deliveredOrders = historyData.filter(o => o.status === 'delivered');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const todayEarnings = deliveredOrders
          .filter(o => new Date(o.created_at) >= today)
          .reduce((sum, o) => sum + Number(o.total_amount), 0);
        const weekEarnings = deliveredOrders
          .filter(o => new Date(o.created_at) >= weekAgo)
          .reduce((sum, o) => sum + Number(o.total_amount), 0);
        const totalEarnings = deliveredOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

        setEarnings({
          today: todayEarnings,
          week: weekEarnings,
          total: totalEarnings,
          orderCount: deliveredOrders.length
        });
      }
    } else {
      setShowCreateRestaurant(true);
    }

    setLoading(false);
  };

  const subscribeToOrders = () => {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

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
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      // Use secure RPC to assign restaurant_owner role
      await supabase.rpc('request_restaurant_owner_role');
      
      setRestaurant(data);
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
      })
      .eq('id', restaurant.id);

    if (error) {
      toast.error('Failed to update location');
    } else {
      setRestaurant(prev => prev ? { 
        ...prev, 
        lat: restaurantForm.lat ? parseFloat(restaurantForm.lat) : null,
        lng: restaurantForm.lng ? parseFloat(restaurantForm.lng) : null,
      } : null);
      toast.success('Shop location updated!');
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
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
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={restaurantForm.image_url}
                  onChange={(e) => setRestaurantForm({ ...restaurantForm, image_url: e.target.value })}
                  placeholder="https://..."
                />
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
      </div>
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
                <Store className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold">{restaurant?.name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
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
            <TabsTrigger value="earnings" className="gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Earnings</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {orders.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No active orders</h3>
                  <p className="text-muted-foreground">Orders will appear here when customers place them</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {orders.map((order) => (
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
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input
                        value={menuItemForm.image_url}
                        onChange={(e) => setMenuItemForm({ ...menuItemForm, image_url: e.target.value })}
                      />
                    </div>
                    <Button className="w-full" onClick={addMenuItem}>Add Item</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {menuItems.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <p className="text-muted-foreground">No menu items yet. Add your first item!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {menuItems.map((item) => (
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
                  <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input
                      value={menuItemForm.image_url}
                      onChange={(e) => setMenuItemForm({ ...menuItemForm, image_url: e.target.value })}
                    />
                  </div>
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

          {/* Earnings Tab */}
          <TabsContent value="earnings" className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <IndianRupee className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Today</p>
                      <p className="text-2xl font-bold">₹{earnings.today.toFixed(0)}</p>
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
                      <p className="text-2xl font-bold">₹{earnings.week.toFixed(0)}</p>
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
                      <p className="text-sm text-muted-foreground">Total Earnings</p>
                      <p className="text-2xl font-bold">₹{earnings.total.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Orders Delivered</p>
                      <p className="text-2xl font-bold">{earnings.orderCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Commission Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Platform Commission Rate</span>
                  <span className="font-bold">{restaurant?.commission_rate || 15}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Commission is deducted from each order. Settlements are processed weekly.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shop Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set your shop's GPS location so customers can see distance and get accurate delivery estimates.
                </p>
                
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Current Location</p>
                    {restaurant?.lat && restaurant?.lng ? (
                      <p className="text-xs text-accent flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {Number(restaurant.lat).toFixed(4)}, {Number(restaurant.lng).toFixed(4)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">Not set</p>
                    )}
                  </div>
                  <Button
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
                    Detect Location
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={restaurantForm.lat}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, lat: e.target.value })}
                      placeholder="12.9716"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={restaurantForm.lng}
                      onChange={(e) => setRestaurantForm({ ...restaurantForm, lng: e.target.value })}
                      placeholder="77.5946"
                    />
                  </div>
                </div>

                <Button 
                  onClick={updateShopLocation} 
                  disabled={!restaurantForm.lat || !restaurantForm.lng}
                  className="w-full"
                >
                  Save Location
                </Button>
              </CardContent>
            </Card>

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
                  <span className="text-sm text-muted-foreground">Verification Status</span>
                  <span className={`font-medium ${restaurant?.is_verified ? 'text-accent' : 'text-status-pending'}`}>
                    {restaurant?.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
