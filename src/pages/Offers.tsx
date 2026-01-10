import React, { useState, useEffect, forwardRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Percent, Clock, Gift, Phone, Check, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  valid_till: string | null;
  discount_type: string | null;
  discount_value: number | null;
  min_order_amount: number | null;
  max_discount_amount: number | null;
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

const OffersPage = forwardRef<HTMLDivElement>((_, ref) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);



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

  const fetchUserPhone = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle();

    if (data?.phone) {
      setUserPhone(data.phone);
      setPhoneNumber(data.phone);
    }
  }, [user]);

  useEffect(() => {
    fetchCoupons();
    if (user) {
      fetchUserPhone();
    }

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
  }, [user, fetchUserPhone]);

  const handleApplyCoupon = (coupon: Coupon) => {
    if (!user) {
      toast.error('Please sign in to apply coupons');
      navigate('/auth');
      return;
    }

    if (!userPhone) {
      setSelectedCoupon(coupon);
      setPhoneDialogOpen(true);
    } else {
      copyCodeAndNavigate(coupon.code);
    }
  };

  const handleSavePhoneAndApply = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ phone: phoneNumber })
      .eq('id', user!.id);

    if (error) {
      toast.error('Failed to save phone number');
      return;
    }

    setUserPhone(phoneNumber);
    setPhoneDialogOpen(false);
    if (selectedCoupon) {
      copyCodeAndNavigate(selectedCoupon.code);
    }
  };

  const copyCodeAndNavigate = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Code ${code} copied! Redirecting to cart...`);
    setTimeout(() => {
      navigate('/cart');
    }, 1500);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div ref={ref} className="min-h-screen bg-background">
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
                    <div className="w-24 h-28 bg-muted" />
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
                  <div className="w-24 flex items-center justify-center bg-card/50 border-r-2 border-dashed border-border">
                    <div className="text-center p-2">
                      <Percent className={`w-8 h-8 mx-auto ${iconColors[index % iconColors.length]}`} />
                      <p className="text-xs font-bold mt-1 break-all">{coupon.code}</p>
                    </div>
                  </div>
                  <div className="flex-1 p-4">
                    <h3 className="font-bold text-lg">{coupon.title}</h3>
                    {coupon.description && (
                      <p className="text-sm text-muted-foreground mt-1">{coupon.description}</p>
                    )}
                    {coupon.min_order_amount && coupon.min_order_amount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Min. order: ₹{coupon.min_order_amount}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <div className="flex-1">
                        {coupon.valid_till && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {coupon.valid_till}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => copyCode(coupon.code)}
                        >
                          {copiedCode === coupon.code ? (
                            <><Check className="w-3 h-3 mr-1" /> Copied</>
                          ) : (
                            <><Copy className="w-3 h-3 mr-1" /> Copy</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => handleApplyCoupon(coupon)}
                        >
                          Apply
                        </Button>
                      </div>
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

      {/* Phone Number Dialog */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Mobile Number Required
            </DialogTitle>
            <DialogDescription>
              Please add your mobile number to apply coupons and receive order updates.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="phone">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Enter 10-digit mobile number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="mt-2"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground mt-2">
              We'll use this number to send order updates via SMS/WhatsApp
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePhoneAndApply} disabled={phoneNumber.length !== 10}>
              Save & Apply Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

OffersPage.displayName = 'OffersPage';

export default OffersPage;
