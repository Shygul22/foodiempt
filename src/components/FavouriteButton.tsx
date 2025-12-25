import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
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

export function FavouriteButton({ restaurantId, className, size = 'icon' }: FavouriteButtonProps) {
  const { user } = useAuth();
  const [isFavourite, setIsFavourite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkFavourite();
    }
  }, [user, restaurantId]);

  const checkFavourite = async () => {
    const { data } = await supabase
      .from('favourite_shops')
      .select('id')
      .eq('user_id', user!.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    
    setIsFavourite(!!data);
  };

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
        toast.success('Removed from favourites');
      } else {
        await supabase
          .from('favourite_shops')
          .insert({
            user_id: user.id,
            restaurant_id: restaurantId,
          });
        
        setIsFavourite(true);
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
