-- Allow delivery partners to view profiles of customers on their assigned orders
CREATE POLICY "Delivery partners can view customer profiles for their orders"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
    WHERE dp.user_id = auth.uid()
    AND o.customer_id = profiles.id
  )
);

-- Allow delivery partners to view profiles of customers on available orders (ready_for_pickup with no partner)
CREATE POLICY "Delivery partners can view customer profiles for available orders"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM delivery_partners dp
    WHERE dp.user_id = auth.uid()
    AND dp.is_available = true
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.customer_id = profiles.id
      AND o.status = 'ready_for_pickup'
      AND o.delivery_partner_id IS NULL
    )
  )
);