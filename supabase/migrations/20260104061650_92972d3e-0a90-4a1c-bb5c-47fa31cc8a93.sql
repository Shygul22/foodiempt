-- Allow delivery partners to view available orders (ready_for_pickup with no assigned partner)
CREATE POLICY "Delivery partners can view available orders" 
ON public.orders 
FOR SELECT 
USING (
  status = 'ready_for_pickup' 
  AND delivery_partner_id IS NULL 
  AND EXISTS (
    SELECT 1 FROM delivery_partners 
    WHERE delivery_partners.user_id = auth.uid() 
    AND delivery_partners.is_available = true
  )
);