-- Fix verify_pickup_and_accept_order to work with the new flow (Accepted -> Verify OTP)
CREATE OR REPLACE FUNCTION public.verify_pickup_and_accept_order(
  _order_id UUID,
  _pickup_otp TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _partner_id UUID;
BEGIN
  -- Get delivery partner ID for current user
  SELECT id INTO _partner_id
  FROM delivery_partners
  WHERE user_id = auth.uid() AND is_available = true;
  
  IF _partner_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Atomic: verify OTP and update order
  -- NOW checks that the order is assigned to the calling partner
  UPDATE orders
  SET 
    status = 'picked_up'
  WHERE 
    id = _order_id AND
    pickup_otp = _pickup_otp AND
    status = 'ready_for_pickup' AND
    delivery_partner_id = _partner_id; -- Must be assigned to me
  
  RETURN FOUND;
END;
$$;
