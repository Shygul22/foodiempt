import { useState, useEffect, forwardRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { ImpactStyle } from '@capacitor/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FavouriteButtonProps {
  restaurantId: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export const FavouriteButton = forwardRef<HTMLButtonElement, FavouriteButtonProps>(
  ({ restaurantId, className, size = 'icon' }, ref) => {
    const { user } = useAuth();
    const [isFavourite, setIsFavourite] = useState(false);
    const [loading, setLoading] = useState(false);
    const haptics = useHaptics();

    const checkFavourite = useCallback(async () => {
      const { data } = await supabase
        .from('favourite_shops')
        .select('id')
        .eq('user_id', user!.id)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      setIsFavourite(!!data);
    }, [user, restaurantId]);

    useEffect(() => {
      if (user) {
        checkFavourite();
      }
    }, [user, restaurantId, checkFavourite]);

    const toggleFavourite = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!user) {
        toast.error('Please sign in to save favourites');
        return;
      }

      setLoading(true);
      try {
        if (isFavourite) {
          await supabase
            .from('favourite_shops')
            .delete()
            .eq('user_id', user.id)
            .eq('restaurant_id', restaurantId);

          setIsFavourite(false);
          haptics.impact(ImpactStyle.Light);
          toast.success('Removed from favourites');
        } else {
          await supabase
            .from('favourite_shops')
            .insert({
              user_id: user.id,
              restaurant_id: restaurantId,
            });

          setIsFavourite(true);
          haptics.impact(ImpactStyle.Medium);
          toast.success('Added to favourites');
        }
      } catch (error) {
        toast.error('Failed to update favourite');
      } finally {
        setLoading(false);
      }
    };

    return (
      <Button
        ref={ref}
        variant="ghost"
        size={size}
        onClick={toggleFavourite}
        disabled={loading}
        className={cn(
          "rounded-full bg-card/80 backdrop-blur-sm hover:bg-card",
          className
        )}
      >
        <Heart
          className={cn(
            "w-5 h-5 transition-colors",
            isFavourite ? "fill-destructive text-destructive" : "text-muted-foreground"
          )}
        />
      </Button>
    );
  }
);

FavouriteButton.displayName = "FavouriteButton";
