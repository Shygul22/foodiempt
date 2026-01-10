import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customer_id: string;
}

interface RestaurantReviewsProps {
  restaurantId: string;
}

export function RestaurantReviews({ restaurantId }: RestaurantReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('restaurant_reviews')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching reviews:', error);
    } else if (data) {
      setReviews(data);
      if (data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setStats({ average: avg, count: data.length });
      }
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, restaurantId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-muted rounded-lg" />
        <div className="h-32 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Customer Reviews</h3>
              <p className="text-sm text-muted-foreground">
                {stats.count} {stats.count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
            {stats.count > 0 && (
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6 fill-status-pending text-status-pending" />
                <span className="text-2xl font-bold">{stats.average.toFixed(1)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No reviews yet</p>
            <p className="text-sm text-muted-foreground">Be the first to review!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= review.rating
                              ? 'fill-status-pending text-status-pending'
                              : 'text-muted-foreground/30'
                              }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(review.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-foreground mt-2">
                        {review.review_text}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
