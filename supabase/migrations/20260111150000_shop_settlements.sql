
-- Modify settlements table to support restaurants
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.settlements ALTER COLUMN delivery_partner_id DROP NOT NULL;

-- Add constraint to ensure either partner or restaurant is set, but not both (or at least one)
DO $$ 
BEGIN 
    ALTER TABLE public.settlements
        ADD CONSTRAINT settlement_target_check 
        CHECK (
            (delivery_partner_id IS NOT NULL AND restaurant_id IS NULL) OR 
            (delivery_partner_id IS NULL AND restaurant_id IS NOT NULL)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add RLS policy for restaurants
DROP POLICY IF EXISTS "Restaurants can view own settlements" ON public.settlements;

CREATE POLICY "Restaurants can view own settlements"
    ON public.settlements
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT id FROM public.restaurants
            WHERE owner_id = auth.uid()
        )
    );
