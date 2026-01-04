-- Create restaurant reviews table
CREATE TABLE public.restaurant_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id) -- One review per order
);

-- Enable RLS
ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

-- Customers can view all reviews for restaurants
CREATE POLICY "Anyone can view restaurant reviews"
ON public.restaurant_reviews
FOR SELECT
USING (true);

-- Customers can create reviews for their delivered orders
CREATE POLICY "Customers can create reviews for their orders"
ON public.restaurant_reviews
FOR INSERT
WITH CHECK (
  auth.uid() = customer_id AND
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = restaurant_reviews.order_id
      AND orders.customer_id = auth.uid()
      AND orders.status = 'delivered'
  )
);

-- Customers can update their own reviews
CREATE POLICY "Customers can update their own reviews"
ON public.restaurant_reviews
FOR UPDATE
USING (auth.uid() = customer_id);

-- Customers can delete their own reviews
CREATE POLICY "Customers can delete their own reviews"
ON public.restaurant_reviews
FOR DELETE
USING (auth.uid() = customer_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all reviews"
ON public.restaurant_reviews
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));