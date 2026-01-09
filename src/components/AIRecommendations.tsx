import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, Star, MapPin, Utensils, RefreshCw, ChevronRight } from 'lucide-react';

interface RecommendedRestaurant {
  id: string;
  name: string;
  cuisine_type: string | null;
  category: string | null;
  address: string;
  is_open: boolean;
  image_url: string | null;
  recommendationReason: string;
}

export function AIRecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendedRestaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('recommend-restaurants', {
        body: {
          userId: user?.id || null,
          userLocation: null, // Could add geolocation here
        },
      });

      if (error) throw error;
      if (data?.recommendations) {
        setRecommendations(data.recommendations);
      }
<<<<<<< HEAD
    } catch (err: unknown) {
=======
    } catch (err: any) {
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
      console.error('Failed to fetch recommendations:', err);
      setError('Unable to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [user?.id]);

  if (loading) {
    return (
      <section className="py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <h2 className="text-lg font-bold">Finding recommendations...</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="min-w-[280px] animate-pulse border-0 shadow-sm">
                <div className="aspect-[16/10] bg-muted" />
                <CardContent className="p-3">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || recommendations.length === 0) {
    return null;
  }

  return (
    <section className="py-4 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Recommended for You</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecommendations}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {recommendations.map((restaurant) => (
            <Link
              key={restaurant.id}
              to={`/restaurant/${restaurant.id}`}
              className="group min-w-[280px]"
            >
              <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-200 bg-card">
                <div className="relative aspect-[16/10] bg-gradient-to-br from-secondary to-muted overflow-hidden">
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

                  {/* AI Badge */}
                  <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-[10px] gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Pick
                  </Badge>

                  {/* Status Badge */}
                  <Badge
                    variant={restaurant.is_open ? 'default' : 'secondary'}
<<<<<<< HEAD
                    className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 ${restaurant.is_open
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted/90 text-muted-foreground'
                      }`}
=======
                    className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 ${
                      restaurant.is_open
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted/90 text-muted-foreground'
                    }`}
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
                  >
                    {restaurant.is_open ? 'Open' : 'Closed'}
                  </Badge>

                  {/* Delivery Time */}
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
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                      {restaurant.cuisine_type}
                    </p>
                  )}

                  {/* AI Recommendation Reason */}
                  <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 rounded-full px-2 py-1 mt-2">
                    <Sparkles className="w-3 h-3" />
                    <span className="line-clamp-1">{restaurant.recommendationReason}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* View All Card */}
          <Link to="/" className="min-w-[120px] flex items-center">
            <Card className="h-full w-full border-dashed border-2 border-muted hover:border-primary/50 transition-colors flex items-center justify-center">
              <CardContent className="p-4 text-center">
                <ChevronRight className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <span className="text-xs text-muted-foreground">View All</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </section>
  );
}
