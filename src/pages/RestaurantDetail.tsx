import React, { useState, useEffect, forwardRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Restaurant, MenuItem } from '@/types/database';
import { useCartStore } from '@/stores/cartStore';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RestaurantReviews } from '@/components/RestaurantReviews';

import {
  ArrowLeft,
  MapPin,
  Clock,
  Star,
  Plus,
  Minus,
  ShoppingCart,
  Utensils
} from 'lucide-react';
import { toast } from 'sonner';
import { useHaptics } from "@/hooks/useHaptics";
import { ImpactStyle, NotificationType } from "@capacitor/haptics";

const RestaurantDetail = forwardRef<HTMLDivElement>((_, ref) => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviewStats, setReviewStats] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const { items, addItem, updateQuantity, getTotalItems, getTotalAmount } = useCartStore();
  const { impact, notification } = useHaptics();



  const fetchRestaurantAndMenu = useCallback(async () => {
    if (!id) return;
    const [restaurantRes, menuRes, reviewsRes] = await Promise.all([
      supabase.from('restaurants').select('*').eq('id', id).maybeSingle(),
      supabase.from('menu_items').select('*').eq('restaurant_id', id).eq('is_available', true).order('category'),
      supabase.from('restaurant_reviews').select('rating').eq('restaurant_id', id),
    ]);

    if (restaurantRes.data) {
      setRestaurant(restaurantRes.data);
    }
    if (menuRes.data) {
      setMenuItems(menuRes.data);
    }
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const avg = reviewsRes.data.reduce((sum, r) => sum + r.rating, 0) / reviewsRes.data.length;
      setReviewStats({ average: avg, count: reviewsRes.data.length });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchRestaurantAndMenu();
    }
  }, [id, fetchRestaurantAndMenu]);

  const getItemQuantity = (menuItemId: string) => {
    const cartItem = items.find((item) => item.menuItem.id === menuItemId);
    return cartItem?.quantity || 0;
  };

  const handleAddItem = (menuItem: MenuItem) => {
    if (!user) {
      toast.error('Please sign in to add items to cart');
      notification(NotificationType.Error);
      return;
    }
    if (!restaurant?.is_open) {
      toast.error('This shop is currently closed');
      notification(NotificationType.Error);
      return;
    }
    impact(ImpactStyle.Medium);
    addItem(menuItem, restaurant!.id);
    toast.success(`Added ${menuItem.name} to cart`);
  };

  const handleUpdateQuantity = (menuItemId: string, delta: number) => {
    impact(ImpactStyle.Light);
    const currentQty = getItemQuantity(menuItemId);
    updateQuantity(menuItemId, currentQty + delta);
  };

  const groupedItems = menuItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Shop not found</h2>
          <Link to="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <Link to="/cart" className="relative">
              <Button variant="outline" size="icon">
                <ShoppingCart className="w-5 h-5" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                    {getTotalItems()}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Restaurant Hero */}
      <div className="relative h-64 lg:h-80 bg-gradient-to-br from-secondary to-muted overflow-hidden">
        {restaurant.image_url ? (
          <img
            src={restaurant.image_url}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="w-24 h-24 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="container mx-auto">
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium mb-3 ${restaurant.is_open
              ? 'bg-accent text-accent-foreground'
              : 'bg-destructive text-destructive-foreground'
              }`}>
              {restaurant.is_open ? 'Open Now' : 'Closed'}
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">{restaurant.name}</h1>
            {restaurant.cuisine_type && (
              <p className="text-muted-foreground mb-3">{restaurant.cuisine_type}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-status-pending text-status-pending" />
                <span className="font-medium text-foreground">
                  {reviewStats.count > 0 ? reviewStats.average.toFixed(1) : '4.5'}
                </span>
                <span>({reviewStats.count > 0 ? `${reviewStats.count} reviews` : '120+ ratings'})</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>25-35 min</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{restaurant.address}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="container mx-auto px-4 py-8">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-16">
            <Utensils className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No menu items yet</h3>
            <p className="text-muted-foreground">This shop hasn't added any items to their menu.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">
                  {category}
                </h2>
                <div className="grid gap-4">
                  {items.map((item) => {
                    const quantity = getItemQuantity(item.id);
                    return (
                      <Card key={item.id} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                          <div className="flex">
                            <div className="flex-1 p-4">
                              <h3 className="font-semibold text-foreground mb-1">{item.name}</h3>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                              <p className="text-lg font-bold text-primary">₹{Number(item.price).toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4 gap-2">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-20 h-20 object-cover rounded-lg"
                                />
                              )}
                              {quantity > 0 ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => handleUpdateQuantity(item.id, -1)}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">{quantity}</span>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => handleUpdateQuantity(item.id, 1)}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleAddItem(item)}
                                  disabled={!restaurant.is_open}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Customer Reviews Section */}
        <div className="mt-10">
          <RestaurantReviews restaurantId={id!} />
        </div>
      </div>

      {/* Floating Cart Button */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50">
          <div className="container mx-auto max-w-lg">
            <Link to="/cart">
              <Button className="w-full h-14 shadow-lg" size="lg">
                <ShoppingCart className="w-5 h-5 mr-2" />
                <span>View Cart ({getTotalItems()})</span>
                <span className="ml-auto">₹{getTotalAmount().toFixed(2)}</span>
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
});

RestaurantDetail.displayName = 'RestaurantDetail';

export default RestaurantDetail;
