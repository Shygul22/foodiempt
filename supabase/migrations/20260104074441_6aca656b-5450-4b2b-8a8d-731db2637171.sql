-- Add delivery_fee column to orders for admin fee tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 25;

-- Create a function to release order back to pool when delivery partner cancels
CREATE OR REPLACE FUNCTION public.release_order_to_pool(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _partner_id UUID;
BEGIN
  -- Get delivery partner ID for current user
  SELECT id INTO _partner_id
  FROM delivery_partners
  WHERE user_id = auth.uid();
  
  IF _partner_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Release order back to pool (only if it's assigned to this partner and not yet delivered)
  UPDATE orders
  SET 
    delivery_partner_id = NULL,
    status = 'ready_for_pickup'
  WHERE 
    id = _order_id AND
    delivery_partner_id = _partner_id AND
    status IN ('picked_up', 'on_the_way');
  
  RETURN FOUND;
END;
$$;

-- Create a function to check if partner has active orders
CREATE OR REPLACE FUNCTION public.partner_has_active_order()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM orders o
    JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
    WHERE dp.user_id = auth.uid()
      AND o.status IN ('picked_up', 'on_the_way')
  )
$$;