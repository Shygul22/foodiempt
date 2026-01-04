-- Create promotions table for admin-controlled promotions with image uploads
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  discount TEXT NOT NULL,
  image_url TEXT,
  valid_till TEXT,
  tag TEXT DEFAULT 'New',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create coupons table for admin-controlled offers/coupons
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  valid_till TEXT,
  discount_type TEXT DEFAULT 'percentage',
  discount_value NUMERIC DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Policies for promotions - everyone can view active ones
CREATE POLICY "Anyone can view active promotions"
ON public.promotions FOR SELECT
USING (is_active = true);

-- Admins can manage all promotions
CREATE POLICY "Admins can manage promotions"
ON public.promotions FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Policies for coupons - everyone can view active ones
CREATE POLICY "Anyone can view active coupons"
ON public.coupons FOR SELECT
USING (is_active = true);

-- Admins can manage all coupons
CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Add triggers for updated_at
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;

-- Create storage bucket for promotion images
INSERT INTO storage.buckets (id, name, public) VALUES ('promotion-images', 'promotion-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for promotion images
CREATE POLICY "Anyone can view promotion images"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotion-images');

CREATE POLICY "Admins can upload promotion images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'promotion-images' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update promotion images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'promotion-images' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete promotion images"
ON storage.objects FOR DELETE
USING (bucket_id = 'promotion-images' AND has_role(auth.uid(), 'super_admin'));