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
  Store, 
  ArrowLeft, 
  Plus, 
  Package, 
  DollarSign,
  Clock,
  Edit,
  Trash2,
  Power,
  Key,
  Banknote,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrderWithItems extends Order {
  order_items: { quantity: number; unit_price: number; menu_items: { name: string } | null }[];
}

export default function RestaurantDashboard() {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
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
  });

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
      subscribeToOrders();
    }
  }, [user, authLoading]);

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

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, order_items(quantity, unit_price, menu_items(name))')
        .eq('restaurant_id', restaurantData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (ordersData) setOrders(ordersData as OrderWithItems[]);
    } else {
      setShowCreateRestaurant(true);
    }

    setLoading(false);
  };

  const subscribeToOrders = () => {
    if (!restaurant?.id) return;

    const channel = supabase
      .channel('restaurant-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
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
        ...restaurantForm,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      // Add restaurant_owner role
      await supabase.from('user_roles').insert({
        user_id: user!.id,
        role: 'restaurant_owner',
      });
      
      setRestaurant(data);
      setShowCreateRestaurant(false);
      toast.success('Shop created! Awaiting admin verification.');
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
                    placeholder="+1 234 567 8900"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cuisine Type</Label>
                  <Input
                    value={restaurantForm.cuisine_type}
                    onChange={(e) => setRestaurantForm({ ...restaurantForm, cuisine_type: e.target.value })}
                    placeholder="Italian, Chinese..."
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
              <Button className="w-full" onClick={createRestaurant}>
                Register Shop
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing');

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
          <TabsList>
            <TabsTrigger value="orders" className="relative">
              Orders
              {pendingOrders.length > 0 && (
                <span className="ml-2 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {pendingOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="menu">Menu Items</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {orders.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
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
                          <p className="font-mono text-sm text-muted-foreground">#{order.id.slice(0, 8)}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-4 h-4" />
                            {format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        <StatusBadge status={order.status as OrderStatus} />
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        {order.order_items.map((item, idx) => (
                          <p key={idx} className="text-sm">
                            {item.quantity}x {item.menu_items?.name || 'Unknown'} - ₹{(Number(item.unit_price) * item.quantity).toFixed(2)}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <p className="font-bold">₹{Number(order.total_amount).toFixed(2)}</p>
                        <div className="flex gap-2">
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
                            <Button size="sm" onClick={() => updateOrderStatus(order.id, 'preparing')}>
                              Start Preparing
                            </Button>
                          )}
                          {order.status === 'preparing' && (
                            <Button size="sm" onClick={() => updateOrderStatus(order.id, 'ready_for_pickup')}>
                              Ready for Pickup
                            </Button>
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

                      {order.delivery_address && (
                        <p className="text-sm text-muted-foreground mt-2">
                          📍 {order.delivery_address}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

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
                        <Label>Price *</Label>
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
                      <Label>Price *</Label>
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
        </Tabs>
      </div>
    </div>
  );
}
