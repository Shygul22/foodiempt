-- Create order_ratings table
CREATE TABLE public.order_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  delivery_partner_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS
ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

-- Customers can view their own ratings
CREATE POLICY "Customers can view their ratings"
ON public.order_ratings
FOR SELECT
USING (auth.uid() = customer_id);

-- Customers can create ratings for their delivered orders
CREATE POLICY "Customers can rate their delivered orders"
ON public.order_ratings
FOR INSERT
WITH CHECK (
  auth.uid() = customer_id AND
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_id 
    AND orders.customer_id = auth.uid() 
    AND orders.status = 'delivered'
  )
);

-- Delivery partners can view ratings for their deliveries
CREATE POLICY "Delivery partners can view their ratings"
ON public.order_ratings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM delivery_partners
    WHERE delivery_partners.id = delivery_partner_id
    AND delivery_partners.user_id = auth.uid()
  )
);

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
ON public.order_ratings
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Enable realtime for ratings
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_ratings;