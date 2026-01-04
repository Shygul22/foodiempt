import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock, Tag, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const promotions = [
  {
    id: 1,
    title: 'Weekend Feast',
    description: 'Enjoy special discounts on premium restaurants every weekend',
    discount: 'Up to 40% OFF',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=200&fit=crop',
    validTill: 'Every Weekend',
    tag: 'Popular'
  },
  {
    id: 2,
    title: 'Lunch Specials',
    description: 'Great deals on lunch combos from 11 AM to 3 PM',
    discount: 'Flat ₹80 OFF',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=200&fit=crop',
    validTill: '11 AM - 3 PM Daily',
    tag: 'Limited'
  },
  {
    id: 3,
    title: 'Late Night Cravings',
    description: 'Special offers for orders after 10 PM',
    discount: 'Free Delivery',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=200&fit=crop',
    validTill: 'After 10 PM',
    tag: 'New'
  },
  {
    id: 4,
    title: 'Healthy Week',
    description: 'Discounts on salads, smoothies, and healthy meals',
    discount: '25% OFF',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=200&fit=crop',
    validTill: 'This Week Only',
    tag: 'Trending'
  }
];

export default function Promotions() {
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
        {promotions.map((promo) => (
          <Link key={promo.id} to="/">
            <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="relative">
                <img 
                  src={promo.image} 
                  alt={promo.title}
                  className="w-full h-40 object-cover"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="secondary" className="bg-primary text-primary-foreground">
                    {promo.tag}
                  </Badge>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <span className="text-white font-bold text-lg">{promo.discount}</span>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{promo.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{promo.description}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Clock className="w-3 h-3" />
                      {promo.validTill}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
