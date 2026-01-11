
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    restaurantId: string;
    className?: string;
}

interface DeliveryArea {
    pincode: string;
    description: string | null;
}

export function RestaurantDeliveryAreas({ restaurantId, className }: Props) {
    const [areas, setAreas] = useState<DeliveryArea[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPincodes = async () => {
            try {
                const { data, error } = await supabase
                    .from('restaurant_delivery_pincodes')
                    .select('pincode, description')
                    .eq('restaurant_id', restaurantId)
                    .eq('is_active', true);

                if (error) throw error;
                setAreas(data || []);
            } catch (error) {
                console.error('Error fetching delivery areas:', error);
            } finally {
                setLoading(false);
            }
        };

        if (restaurantId) {
            fetchPincodes();
        }
    }, [restaurantId]);

    if (loading || areas.length === 0) return null;

    return (
        <div className={cn("flex items-start gap-1 text-sm text-muted-foreground mt-1", className)}>
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="line-clamp-1">
                Delivers to: {areas.map(area =>
                    area.description ? `${area.pincode} (${area.description})` : area.pincode
                ).join(', ')}
            </span>
        </div>
    );
}
