import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewFormProps {
  orderId: string;
  restaurantId: string;
  customerId: string;
  restaurantName: string;
  onReviewSubmitted?: () => void;
}

export function ReviewForm({ orderId, restaurantId, customerId, restaurantName, onReviewSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from('restaurant_reviews').insert({
        order_id: orderId,
        restaurant_id: restaurantId,
        customer_id: customerId,
        rating,
        review_text: reviewText || null,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already reviewed this order');
        } else {
          throw error;
        }
      } else {
        toast.success('Review submitted successfully!');
        onReviewSubmitted?.();
      }
    } catch (error: unknown) {
      console.error('Error submitting review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit review';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm border-accent/20 bg-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-accent" />
          Rate Your Experience
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          How was your order from {restaurantName}?
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Star Rating */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-10 h-10 transition-colors ${star <= (hoverRating || rating)
                  ? 'fill-status-pending text-status-pending'
                  : 'text-muted-foreground/30'
                  }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {rating === 0 && 'Tap to rate'}
          {rating === 1 && 'Poor'}
          {rating === 2 && 'Fair'}
          {rating === 3 && 'Good'}
          {rating === 4 && 'Very Good'}
          {rating === 5 && 'Excellent!'}
        </p>

        {/* Review Text */}
        <Textarea
          placeholder="Share your experience (optional)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={3}
          className="resize-none"
        />

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Submit Review
        </Button>
      </CardContent>
    </Card>
  );
}
