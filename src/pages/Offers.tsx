import { Link } from 'react-router-dom';
import { ArrowLeft, Tag, Percent, Clock, Gift } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const offers = [
  {
    id: 1,
    code: 'WELCOME50',
    title: '50% OFF on First Order',
    description: 'Get 50% off up to ₹100 on your first order',
    validTill: 'Valid for new users',
    bgClass: 'from-primary/20 to-accent/20',
    iconColor: 'text-primary'
  },
  {
    id: 2,
    code: 'FREEDEL',
    title: 'Free Delivery',
    description: 'Free delivery on orders above ₹199',
    validTill: 'Valid till 31st Jan',
    bgClass: 'from-accent/20 to-status-confirmed/20',
    iconColor: 'text-accent'
  },
  {
    id: 3,
    code: 'SAVE100',
    title: 'Flat ₹100 OFF',
    description: 'Get ₹100 off on orders above ₹499',
    validTill: 'Valid on weekends',
    bgClass: 'from-status-preparing/20 to-status-pending/20',
    iconColor: 'text-status-preparing'
  },
  {
    id: 4,
    code: 'HEALTHY20',
    title: '20% OFF on Healthy Food',
    description: 'Get 20% off on salads and healthy bowls',
    validTill: 'Valid all week',
    bgClass: 'from-status-delivered/20 to-accent/20',
    iconColor: 'text-status-delivered'
  }
];

export default function Offers() {
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
        {offers.map((offer) => (
          <Card key={offer.id} className={`border-0 shadow-lg overflow-hidden bg-gradient-to-r ${offer.bgClass}`}>
            <CardContent className="p-0">
              <div className="flex">
                <div className="w-24 flex items-center justify-center bg-card/50">
                  <div className="text-center">
                    <Percent className={`w-8 h-8 mx-auto ${offer.iconColor}`} />
                    <p className="text-xs font-bold mt-1">{offer.code}</p>
                  </div>
                </div>
                <div className="flex-1 p-4">
                  <h3 className="font-bold text-lg">{offer.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{offer.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {offer.validTill}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => copyCode(offer.code)}>
                      Copy Code
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

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
