-- 1. Add restrictive INSERT policy for user_roles to prevent privilege escalation
CREATE POLICY "Users can only self-assign customer role"
ON public.user_roles FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  role = 'customer'
);

-- 2. Create secure RPC function for restaurant owner role assignment
CREATE OR REPLACE FUNCTION public.request_restaurant_owner_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has created a restaurant
  IF EXISTS (
    SELECT 1 FROM restaurants 
    WHERE owner_id = auth.uid()
  ) THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (auth.uid(), 'restaurant_owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- 3. Create secure RPC function for delivery partner role assignment
CREATE OR REPLACE FUNCTION public.request_delivery_partner_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify delivery partner registration is complete with phone verified
  IF EXISTS (
    SELECT 1 FROM delivery_partners 
    WHERE user_id = auth.uid() AND phone_verified = true
  ) THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (auth.uid(), 'delivery_partner')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- 4. Create server-side OTP verification for pickup
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
  UPDATE orders
  SET 
    delivery_partner_id = _partner_id,
    status = 'picked_up'
  WHERE 
    id = _order_id AND
    pickup_otp = _pickup_otp AND
    status = 'ready_for_pickup' AND
    delivery_partner_id IS NULL;
  
  RETURN FOUND;
END;
$$;

-- 5. Create server-side OTP verification for delivery
CREATE OR REPLACE FUNCTION public.verify_delivery_and_complete(
  _order_id UUID,
  _delivery_otp TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify OTP and mark delivered
  UPDATE orders
  SET status = 'delivered'
  WHERE 
    id = _order_id AND
    delivery_otp = _delivery_otp AND
    delivery_partner_id IN (
      SELECT id FROM delivery_partners WHERE user_id = auth.uid()
    ) AND
    status = 'on_the_way';
  
  RETURN FOUND;
END;
$$;

-- 6. Fix storage policies - drop existing weak policies
DROP POLICY IF EXISTS "Shop owners can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can update images" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete images" ON storage.objects;

-- 7. Create path-based ownership policies for storage
CREATE POLICY "Restaurant owners can upload their images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT owner_id FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can update their images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT owner_id FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Restaurant owners can delete their images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT owner_id FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- 8. Drop overly permissive profile policies for delivery partners
DROP POLICY IF EXISTS "Delivery partners can view customer profiles for their orders" ON public.profiles;
DROP POLICY IF EXISTS "Delivery partners can view customer profiles for available orders" ON public.profiles;

-- 9. Create order_customer_info view for controlled customer data access
CREATE OR REPLACE VIEW public.order_customer_info AS
SELECT 
  o.id as order_id,
  o.restaurant_id,
  o.delivery_partner_id,
  o.customer_id,
  p.full_name as customer_name,
  p.phone as customer_phone,
  o.delivery_address
FROM orders o
JOIN profiles p ON o.customer_id = p.id;

-- Enable RLS on the view
ALTER VIEW public.order_customer_info SET (security_invoker = on);

-- 10. Restaurant owners see customer info for their orders
CREATE POLICY "Restaurant owners see customer info"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM restaurants 
    WHERE id = restaurant_id AND owner_id = auth.uid()
  )
);

-- 11. Add unique constraint on user_roles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;