import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Restaurant } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCartStore } from '@/stores/cartStore';
import { CategoryTabs, CategoryType } from '@/components/CategoryTabs';
import { FavouriteButton } from '@/components/FavouriteButton';
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
  Heart
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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <Utensils className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">FoodDash</span>
            </Link>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {/* Role-based navigation */}
                  {hasRole('super_admin') && (
                    <Link to="/admin">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Shield className="w-4 h-4" />
                        <span className="hidden sm:inline">Admin</span>
                      </Button>
                    </Link>
                  )}
                  {hasRole('restaurant_owner') && (
                    <Link to="/restaurant">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Store className="w-4 h-4" />
                        <span className="hidden sm:inline">My Shop</span>
                      </Button>
                    </Link>
                  )}
                  {hasRole('delivery_partner') && (
                    <Link to="/delivery">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Bike className="w-4 h-4" />
                        <span className="hidden sm:inline">Delivery</span>
                      </Button>
                    </Link>
                  )}
                  
                  <Link to="/orders">
                    <Button variant="ghost" size="sm">My Orders</Button>
                  </Link>
                  
                  <Link to="/cart" className="relative">
                    <Button variant="outline" size="icon">
                      <ShoppingCart className="w-5 h-5" />
                      {cartItems > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                          {cartItems}
                        </span>
                      )}
                    </Button>
                  </Link>
                  
                  <Button variant="ghost" size="icon" onClick={handleSignOut}>
                    <LogOut className="w-5 h-5" />
                  </Button>
                </>
              ) : (
                <Link to="/auth">
                  <Button variant="hero" size="sm">Sign In</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-secondary py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center animate-fade-in">
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Delicious food,
              <br />
              <span className="text-primary">delivered fast</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Order from your favorite local shops and get it delivered to your doorstep.
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search shops or cuisines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg rounded-xl shadow-lg border-0 bg-card"
              />
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
      </section>

      {/* Categories */}
      <section className="py-4 bg-card/50 border-b border-border">
        <div className="container mx-auto">
          <CategoryTabs selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>
      </section>

      {/* Restaurants Grid */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-foreground">
                {selectedCategory === 'all' ? 'All Shops' : `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Shops`}
              </h2>
              {user && (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'favourites')}>
                  <TabsList className="h-9">
                    <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
                    <TabsTrigger value="favourites" className="text-xs px-3 gap-1">
                      <Heart className="w-3 h-3" />
                      Favourites
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            {filteredRestaurants.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {filteredRestaurants.length} shops
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="h-48 bg-muted" />
                  <CardContent className="p-4">
                    <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No shops found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Shops will appear here once verified'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((restaurant, index) => (
                <Link
                  key={restaurant.id}
                  to={`/restaurant/${restaurant.id}`}
                  className="group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-slide-up">
                    <div className="relative h-48 bg-gradient-to-br from-secondary to-muted overflow-hidden">
                      {restaurant.image_url ? (
                        <img
                          src={restaurant.image_url}
                          alt={restaurant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Utensils className="w-16 h-16 text-muted-foreground/30" />
                        </div>
                      )}
                      {/* Open/Closed Badge */}
                      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${
                        restaurant.is_open 
                          ? 'bg-accent text-accent-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {restaurant.is_open ? 'Open' : 'Closed'}
                      </div>
                      {/* Category Badge */}
                      <div className="absolute top-3 right-12 px-2 py-1 rounded-full text-xs font-medium bg-card/80 text-foreground capitalize">
                        {restaurant.category || 'food'}
                      </div>
                      {/* Favourite Button */}
                      {user && (
                        <FavouriteButton
                          restaurantId={restaurant.id}
                          className="absolute top-2 right-2"
                        />
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                          {restaurant.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="w-4 h-4 fill-status-pending text-status-pending" />
                          <span className="font-medium">4.5</span>
                        </div>
                      </div>
                      {restaurant.cuisine_type && (
                        <p className="text-sm text-muted-foreground mb-3">{restaurant.cuisine_type}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-[120px]">{restaurant.address}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>25-35 min</span>
                        </div>
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
        <section className="py-16 bg-primary">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">
              Ready to order?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-md mx-auto">
              Create an account to start ordering from your favorite shops
            </p>
            <Link to="/auth">
              <Button variant="secondary" size="lg" className="gap-2">
                Get Started <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
