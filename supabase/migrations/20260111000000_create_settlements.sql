-- Create settlements table
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_partner_id UUID NOT NULL REFERENCES public.delivery_partners(id),
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processed', 'failed')),
    reference_no TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all settlements
CREATE POLICY "Admins can view all settlements"
    ON public.settlements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Admins can insert settlements"
    ON public.settlements
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Admins can update settlements"
    ON public.settlements
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Delivery partners can view their own settlements
CREATE POLICY "Partners can view own settlements"
    ON public.settlements
    FOR SELECT
    USING (
        delivery_partner_id IN (
            SELECT id FROM public.delivery_partners
            WHERE user_id = auth.uid()
        )
    );
