import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Restaurant } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCartStore } from '@/stores/cartStore';
import { CategoryTabs, CategoryType } from '@/components/CategoryTabs';
import { FavouriteButton } from '@/components/FavouriteButton';
import { LocationHeader } from '@/components/LocationHeader';
import { 
  Search, 
  MapPin, 
  Clock, 
  Star, 
  ShoppingCart, 
  Utensils,
  LogOut,
  Shield,
  Store,
  Bike,
  ChevronRight,
  Heart,
  Zap,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

export default function Index() {
  const { user, signOut, hasRole, loading: authLoading } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'favourites'>('all');
  const [loading, setLoading] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const cartItems = useCartStore((state) => state.getTotalItems());

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFavourites();
    }
  }, [user]);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('is_verified', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching restaurants:', error);
    } else {
      setRestaurants(data || []);
    }
    setLoading(false);
  };

  const fetchFavourites = async () => {
    const { data } = await supabase
      .from('favourite_shops')
      .select('restaurant_id')
      .eq('user_id', user!.id);
    
    if (data) {
      setFavouriteIds(data.map(f => f.restaurant_id));
    }
  };

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const matchesSearch = 
      restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.cuisine_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === 'all' || 
      (restaurant.category || 'food') === selectedCategory;
    
    const matchesFavourites = 
      activeTab === 'all' || 
      favouriteIds.includes(restaurant.id);
    
    return matchesSearch && matchesCategory && matchesFavourites;
  });

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Zepto-style Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Location + Brand */}
            <div className="flex items-center gap-2">
              <LocationHeader 
                address={deliveryAddress} 
                onAddressChange={setDeliveryAddress}
              />
            </div>

            {/* Search - Desktop */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search shops, items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-secondary/50 border-0 rounded-full text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {hasRole('super_admin') && (
                    <Link to="/admin">
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Shield className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  {hasRole('restaurant_owner') && (
                    <Link to="/restaurant">
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Store className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  {hasRole('delivery_partner') && (
                    <Link to="/delivery">
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Bike className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                  
                  <Link to="/orders">
                    <Button variant="ghost" size="sm" className="hidden sm:flex text-xs h-9">
                      Orders
                    </Button>
                  </Link>
                  
                  <Link to="/cart" className="relative">
                    <Button variant="default" size="sm" className="h-9 gap-1.5 rounded-full px-3">
                      <ShoppingCart className="w-4 h-4" />
                      {cartItems > 0 && (
                        <span className="font-bold">{cartItems}</span>
                      )}
                    </Button>
                  </Link>
                  
                  <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Link to="/auth">
                  <Button size="sm" className="h-9 rounded-full px-4">Sign In</Button>
                </Link>
              )}
            </div>
          </div>

          {/* Search - Mobile */}
          <div className="md:hidden mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search shops, items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-secondary/50 border-0 rounded-full text-sm"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Quick Info Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-b border-border">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground">Delivery from <strong className="text-foreground">₹15</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span className="text-muted-foreground">Avg <strong className="text-foreground">20-30 min</strong></span>
            </div>
            <div className="flex items-center gap-1.5 hidden sm:flex">
              <TrendingUp className="w-3.5 h-3.5 text-status-confirmed" />
              <span className="text-muted-foreground"><strong className="text-foreground">Free delivery</strong> on ₹199+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <section className="py-3 bg-card/50 border-b border-border sticky top-[52px] md:top-[60px] z-40">
        <div className="container mx-auto">
          <CategoryTabs selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>
      </section>

      {/* Restaurants Grid */}
      <section className="py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">
                {selectedCategory === 'all' ? 'Nearby Shops' : `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}`}
              </h2>
              {user && (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'favourites')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2.5 h-6">All</TabsTrigger>
                    <TabsTrigger value="favourites" className="text-xs px-2.5 h-6 gap-1">
                      <Heart className="w-3 h-3" />
                      Saved
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            {filteredRestaurants.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filteredRestaurants.length} shops
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i} className="overflow-hidden animate-pulse border-0 shadow-sm">
                  <div className="aspect-[4/3] bg-muted" />
                  <CardContent className="p-3">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <Utensils className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No shops found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search' : 'No shops in your area yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredRestaurants.map((restaurant, index) => (
                <Link
                  key={restaurant.id}
                  to={`/restaurant/${restaurant.id}`}
                  className="group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in">
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-secondary to-muted overflow-hidden">
                      {restaurant.image_url ? (
                        <img
                          src={restaurant.image_url}
                          alt={restaurant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Utensils className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <Badge 
                        variant={restaurant.is_open ? "default" : "secondary"}
                        className={`absolute top-2 left-2 text-[10px] px-1.5 py-0.5 ${
                          restaurant.is_open 
                            ? 'bg-accent text-accent-foreground' 
                            : 'bg-muted/90 text-muted-foreground'
                        }`}
                      >
                        {restaurant.is_open ? 'Open' : 'Closed'}
                      </Badge>

                      {/* Favourite Button */}
                      {user && (
                        <FavouriteButton
                          restaurantId={restaurant.id}
                          className="absolute top-2 right-2"
                        />
                      )}

                      {/* Delivery Time Chip */}
                      <div className="absolute bottom-2 left-2 bg-card/95 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-semibold">20-30 min</span>
                      </div>
                    </div>
                    
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {restaurant.name}
                        </h3>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Star className="w-3 h-3 fill-status-pending text-status-pending" />
                          <span className="text-xs font-medium">4.5</span>
                        </div>
                      </div>
                      
                      {restaurant.cuisine_type && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{restaurant.cuisine_type}</p>
                      )}
                      
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">{restaurant.address}</span>
                        </div>
                        <span className="capitalize bg-secondary/80 px-1.5 py-0.5 rounded text-foreground">
                          {restaurant.category || 'food'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section for non-users */}
      {!user && !authLoading && (
        <section className="py-12 bg-primary">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-primary-foreground mb-3">
              Ready to order?
            </h2>
            <p className="text-primary-foreground/80 mb-6 text-sm max-w-md mx-auto">
              Sign up to order from shops near you
            </p>
            <Link to="/auth">
              <Button variant="secondary" size="lg" className="gap-2 rounded-full">
                Get Started <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
