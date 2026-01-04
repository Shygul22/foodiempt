import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Percent, Clock, Gift } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  valid_till: string | null;
  discount_type: string | null;
  discount_value: number | null;
  min_order_amount: number | null;
}

const bgClasses = [
  'from-primary/20 to-accent/20',
  'from-accent/20 to-status-confirmed/20',
  'from-status-preparing/20 to-status-pending/20',
  'from-status-delivered/20 to-accent/20',
];

const iconColors = [
  'text-primary',
  'text-accent',
  'text-status-preparing',
  'text-status-delivered',
];

export default function Offers() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoupons();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('coupons-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coupons'
        },
        () => {
          fetchCoupons();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCoupons(data);
    }
    setLoading(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied!`);
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
              <h1 className="text-xl font-bold">Offers & Coupons</h1>
              <p className="text-sm text-muted-foreground">Save big on your orders</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-lg overflow-hidden animate-pulse">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="w-24 h-24 bg-muted" />
                    <div className="flex-1 p-4 space-y-2">
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12">
            <Percent className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-semibold">No coupons available</h3>
            <p className="text-sm text-muted-foreground">Check back later for exciting offers</p>
          </div>
        ) : (
          coupons.map((coupon, index) => (
            <Card 
              key={coupon.id} 
              className={`border-0 shadow-lg overflow-hidden bg-gradient-to-r ${bgClasses[index % bgClasses.length]}`}
            >
              <CardContent className="p-0">
                <div className="flex">
                  <div className="w-24 flex items-center justify-center bg-card/50">
                    <div className="text-center">
                      <Percent className={`w-8 h-8 mx-auto ${iconColors[index % iconColors.length]}`} />
                      <p className="text-xs font-bold mt-1">{coupon.code}</p>
                    </div>
                  </div>
                  <div className="flex-1 p-4">
                    <h3 className="font-bold text-lg">{coupon.title}</h3>
                    {coupon.description && (
                      <p className="text-sm text-muted-foreground mt-1">{coupon.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      {coupon.valid_till && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {coupon.valid_till}
                        </span>
                      )}
                      <Button size="sm" variant="outline" onClick={() => copyCode(coupon.code)}>
                        Copy Code
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Banner */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-primary to-accent text-white">
          <CardContent className="p-6 text-center">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-90" />
            <h3 className="text-xl font-bold">More Offers Coming Soon!</h3>
            <p className="text-sm opacity-90 mt-2">Keep checking for exclusive deals and discounts</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
