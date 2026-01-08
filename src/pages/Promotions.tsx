import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount: string;
  image_url: string | null;
  valid_till: string | null;
  tag: string | null;
}

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromotions();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('promotions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotions'
        },
        () => {
          fetchPromotions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPromotions = async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setPromotions(data);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Promotions
              </h1>
              <p className="text-sm text-muted-foreground">Special offers just for you</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-lg overflow-hidden animate-pulse">
                <div className="h-40 bg-muted" />
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-semibold">No promotions available</h3>
            <p className="text-sm text-muted-foreground">Check back later for special offers</p>
          </div>
        ) : (
          promotions.map((promo) => (
            <Link key={promo.id} to="/">
              <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative">
                  {promo.image_url ? (
                    <img 
                      src={promo.image_url} 
                      alt={promo.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-primary/50" />
                    </div>
                  )}
                  {promo.tag && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="secondary" className="bg-primary text-primary-foreground">
                        {promo.tag}
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <span className="text-white font-bold text-lg">{promo.discount}</span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{promo.title}</h3>
                      {promo.description && (
                        <p className="text-sm text-muted-foreground mt-1">{promo.description}</p>
                      )}
                      {promo.valid_till && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Clock className="w-3 h-3" />
                          {promo.valid_till}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
