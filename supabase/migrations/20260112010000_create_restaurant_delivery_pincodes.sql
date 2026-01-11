-- Create table for restaurant delivery pincodes
CREATE TABLE IF NOT EXISTS public.restaurant_delivery_pincodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    pincode TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(restaurant_id, pincode)
);

-- Enable RLS
ALTER TABLE public.restaurant_delivery_pincodes ENABLE ROW LEVEL SECURITY;

-- Policies

-- Restaurant owners can view their own pincodes
CREATE POLICY "Restaurant owners can view their own delivery pincodes"
ON public.restaurant_delivery_pincodes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants
        WHERE id = restaurant_delivery_pincodes.restaurant_id
        AND owner_id = auth.uid()
    )
);

-- Restaurant owners can insert their own pincodes
CREATE POLICY "Restaurant owners can insert their own delivery pincodes"
ON public.restaurant_delivery_pincodes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.restaurants
        WHERE id = restaurant_delivery_pincodes.restaurant_id
        AND owner_id = auth.uid()
    )
);

-- Restaurant owners can update their own pincodes
CREATE POLICY "Restaurant owners can update their own delivery pincodes"
ON public.restaurant_delivery_pincodes
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants
        WHERE id = restaurant_delivery_pincodes.restaurant_id
        AND owner_id = auth.uid()
    )
);

-- Restaurant owners can delete their own pincodes
CREATE POLICY "Restaurant owners can delete their own delivery pincodes"
ON public.restaurant_delivery_pincodes
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants
        WHERE id = restaurant_delivery_pincodes.restaurant_id
        AND owner_id = auth.uid()
    )
);

-- Everyone can view active pincodes (for customer app)
CREATE POLICY "Public can view active delivery pincodes"
ON public.restaurant_delivery_pincodes
FOR SELECT
USING (is_active = true);
