-- Create role enum for users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'restaurant_owner', 'delivery_partner', 'customer');
  END IF;
END $$;

-- Create order status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled');
  END IF;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create restaurants table
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  phone TEXT,
  image_url TEXT,
  cuisine_type TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_open BOOLEAN NOT NULL DEFAULT false,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  category TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create delivery_partners table
CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_available BOOLEAN NOT NULL DEFAULT false,
  current_lat DECIMAL(10,8),
  current_lng DECIMAL(11,8),
  vehicle_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  delivery_partner_id UUID REFERENCES public.delivery_partners(id),
  status order_status NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_lat DECIMAL(10,8),
  delivery_lng DECIMAL(11,8),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_partners_updated_at ON public.delivery_partners;
CREATE TRIGGER update_delivery_partners_updated_at BEFORE UPDATE ON public.delivery_partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for restaurants
DROP POLICY IF EXISTS "Anyone can view verified open restaurants" ON public.restaurants;
CREATE POLICY "Anyone can view verified open restaurants" ON public.restaurants FOR SELECT USING (is_verified = true);

DROP POLICY IF EXISTS "Owners can manage their restaurants" ON public.restaurants;
CREATE POLICY "Owners can manage their restaurants" ON public.restaurants FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins can manage all restaurants" ON public.restaurants;
CREATE POLICY "Admins can manage all restaurants" ON public.restaurants FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Restaurant owners can insert their restaurant" ON public.restaurants;
CREATE POLICY "Restaurant owners can insert their restaurant" ON public.restaurants FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- RLS Policies for menu_items
DROP POLICY IF EXISTS "Anyone can view menu items of verified restaurants" ON public.menu_items;
CREATE POLICY "Anyone can view menu items of verified restaurants" ON public.menu_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND is_verified = true)
);

DROP POLICY IF EXISTS "Restaurant owners can manage their menu items" ON public.menu_items;
CREATE POLICY "Restaurant owners can manage their menu items" ON public.menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid())
);

-- RLS Policies for delivery_partners
DROP POLICY IF EXISTS "Delivery partners can manage their own record" ON public.delivery_partners;
CREATE POLICY "Delivery partners can manage their own record" ON public.delivery_partners FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all delivery partners" ON public.delivery_partners;
CREATE POLICY "Admins can view all delivery partners" ON public.delivery_partners FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Restaurants can view available partners" ON public.delivery_partners;
CREATE POLICY "Restaurants can view available partners" ON public.delivery_partners FOR SELECT USING (is_available = true);

-- RLS Policies for orders
DROP POLICY IF EXISTS "Customers can view their orders" ON public.orders;
CREATE POLICY "Customers can view their orders" ON public.orders FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
CREATE POLICY "Customers can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
CREATE POLICY "Restaurant owners can view their orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Restaurant owners can update their orders" ON public.orders;
CREATE POLICY "Restaurant owners can update their orders" ON public.orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Delivery partners can view assigned orders" ON public.orders;
CREATE POLICY "Delivery partners can view assigned orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.delivery_partners WHERE id = delivery_partner_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Delivery partners can update assigned orders" ON public.orders;
CREATE POLICY "Delivery partners can update assigned orders" ON public.orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.delivery_partners WHERE id = delivery_partner_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for order_items
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
CREATE POLICY "Users can view their order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;
CREATE POLICY "Users can create order items for their orders" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Restaurant owners can view their order items" ON public.order_items;
CREATE POLICY "Restaurant owners can view their order items" ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o 
    JOIN public.restaurants r ON o.restaurant_id = r.id 
    WHERE o.id = order_id AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- Enable realtime for orders
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
-- Add payment method and OTP fields to orders table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE public.orders ADD COLUMN payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'gpay'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_otp') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_otp text;
  END IF;
END $$;

-- Create function to generate both pickup and delivery OTPs based on status
CREATE OR REPLACE FUNCTION public.generate_order_otps()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate pickup_otp when order becomes confirmed (or preparing/ready_for_pickup if no OTP yet)
  IF NEW.status IN ('confirmed', 'preparing', 'ready_for_pickup') AND (OLD IS NULL OR OLD.pickup_otp IS NULL) THEN
    IF NEW.pickup_otp IS NULL THEN
      NEW.pickup_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
  END IF;
  
  -- Generate delivery_otp when order is confirmed (or later if no OTP yet)
  IF NEW.status IN ('confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way') AND (OLD IS NULL OR OLD.delivery_otp IS NULL) THEN
    IF NEW.delivery_otp IS NULL THEN
      NEW.delivery_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
  END IF;
  
  -- Handle initial insertion if starting at a relevant status
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('confirmed', 'preparing', 'ready_for_pickup') AND NEW.pickup_otp IS NULL THEN
      NEW.pickup_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    IF NEW.status IN ('confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way') AND NEW.delivery_otp IS NULL THEN
      NEW.delivery_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create unified trigger for all OTP generation
DROP TRIGGER IF EXISTS trigger_generate_order_otps ON public.orders;
CREATE TRIGGER trigger_generate_order_otps
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_otps();

-- Add pickup OTP to orders for restaurant-to-delivery handoff
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_otp text;

-- Add phone and verified status to delivery_partners
ALTER TABLE public.delivery_partners 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_otp text;
-- Create storage bucket for shop images
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view shop images (public bucket)
DROP POLICY IF EXISTS "Anyone can view shop images" ON storage.objects;
CREATE POLICY "Anyone can view shop images"
ON storage.objects FOR SELECT
USING (bucket_id = 'shop-images');

-- Allow shop owners to upload their own images
DROP POLICY IF EXISTS "Shop owners can upload images" ON storage.objects;
CREATE POLICY "Shop owners can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IS NOT NULL
);

-- Allow shop owners to update their own images
DROP POLICY IF EXISTS "Shop owners can update images" ON storage.objects;
CREATE POLICY "Shop owners can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IS NOT NULL
);

-- Allow shop owners to delete their own images
DROP POLICY IF EXISTS "Shop owners can delete images" ON storage.objects;
CREATE POLICY "Shop owners can delete images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IS NOT NULL
);
-- Add category support to restaurants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'category') THEN
    ALTER TABLE public.restaurants ADD COLUMN category text DEFAULT 'food';
  END IF;
END $$;

-- Create enum for shop categories
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_category') THEN
    CREATE TYPE shop_category AS ENUM ('food', 'grocery', 'fruits', 'vegetables', 'meat', 'medicine', 'bakery', 'beverages');
  END IF;
END $$;

-- Create customer addresses table
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Home',
  address text NOT NULL,
  lat numeric,
  lng numeric,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for customer addresses
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer addresses
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.customer_addresses;
CREATE POLICY "Users can view their own addresses" 
ON public.customer_addresses 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own addresses" ON public.customer_addresses;
CREATE POLICY "Users can create their own addresses" 
ON public.customer_addresses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own addresses" ON public.customer_addresses;
CREATE POLICY "Users can update their own addresses" 
ON public.customer_addresses 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own addresses" ON public.customer_addresses;
CREATE POLICY "Users can delete their own addresses" 
ON public.customer_addresses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create favourite shops table
CREATE TABLE IF NOT EXISTS public.favourite_shops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- Enable RLS for favourite shops
ALTER TABLE public.favourite_shops ENABLE ROW LEVEL SECURITY;

-- RLS policies for favourite shops
DROP POLICY IF EXISTS "Users can view their favourites" ON public.favourite_shops;
CREATE POLICY "Users can view their favourites" 
ON public.favourite_shops 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add favourites" ON public.favourite_shops;
CREATE POLICY "Users can add favourites" 
ON public.favourite_shops 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove favourites" ON public.favourite_shops;
CREATE POLICY "Users can remove favourites" 
ON public.favourite_shops 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add scheduled delivery to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;

-- Create trigger for customer_addresses updated_at
DROP TRIGGER IF EXISTS update_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Add lat/lng columns to restaurants table for location-based filtering
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS lat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lng NUMERIC DEFAULT NULL;

-- Add index for location queries
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON public.restaurants (lat, lng);

-- Comment for clarity
COMMENT ON COLUMN public.restaurants.lat IS 'Latitude coordinate for shop location';
COMMENT ON COLUMN public.restaurants.lng IS 'Longitude coordinate for shop location';
-- Functions consolidated above
-- Allow delivery partners to view profiles of customers on their assigned orders
DROP POLICY IF EXISTS "Delivery partners can view customer profiles for their orders" ON public.profiles;
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
DROP POLICY IF EXISTS "Delivery partners can view customer profiles for available orders" ON public.profiles;
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
-- 1. Add restrictive INSERT policy for user_roles to prevent privilege escalation
DROP POLICY IF EXISTS "Users can only self-assign customer role" ON public.user_roles;
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
DROP POLICY IF EXISTS "Restaurant owners can upload their images" ON storage.objects;
CREATE POLICY "Restaurant owners can upload their images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT owner_id FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Restaurant owners can update their images" ON storage.objects;
CREATE POLICY "Restaurant owners can update their images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'shop-images' AND
  auth.uid() IN (
    SELECT owner_id FROM public.restaurants 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Restaurant owners can delete their images" ON storage.objects;
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
DROP POLICY IF EXISTS "Restaurant owners see customer info" ON public.orders;
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
-- Create admin-only function to assign any role to users
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  _target_user_id UUID,
  _role app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN FALSE;
  END IF;
  
  -- Insert the role
  INSERT INTO user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Create admin-only function to remove roles from users
CREATE OR REPLACE FUNCTION public.admin_remove_role(
  _target_user_id UUID,
  _role app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN FALSE;
  END IF;
  
  -- Delete the role
  DELETE FROM user_roles
  WHERE user_id = _target_user_id AND role = _role;
  
  RETURN TRUE;
END;
$$;
-- Create promotions table for admin-controlled promotions with image uploads
CREATE TABLE IF NOT EXISTS public.promotions (
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
CREATE TABLE IF NOT EXISTS public.coupons (
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
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;
CREATE POLICY "Anyone can view active promotions"
ON public.promotions FOR SELECT
USING (is_active = true);

-- Admins can manage all promotions
DROP POLICY IF EXISTS "Admins can manage promotions" ON public.promotions;
CREATE POLICY "Admins can manage promotions"
ON public.promotions FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Policies for coupons - everyone can view active ones
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
CREATE POLICY "Anyone can view active coupons"
ON public.coupons FOR SELECT
USING (is_active = true);

-- Admins can manage all coupons
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_promotions_updated_at ON public.promotions;
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_coupons_updated_at ON public.coupons;
CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'promotions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'coupons') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;
  END IF;
END $$;

-- Create storage bucket for promotion images
INSERT INTO storage.buckets (id, name, public) VALUES ('promotion-images', 'promotion-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for promotion images
DROP POLICY IF EXISTS "Anyone can view promotion images" ON storage.objects;
CREATE POLICY "Anyone can view promotion images"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotion-images');

DROP POLICY IF EXISTS "Admins can upload promotion images" ON storage.objects;
CREATE POLICY "Admins can upload promotion images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'promotion-images' AND has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can update promotion images" ON storage.objects;
CREATE POLICY "Admins can update promotion images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'promotion-images' AND has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can delete promotion images" ON storage.objects;
CREATE POLICY "Admins can delete promotion images"
ON storage.objects FOR DELETE
USING (bucket_id = 'promotion-images' AND has_role(auth.uid(), 'super_admin'));
-- Allow delivery partners to view available orders (ready_for_pickup with no assigned partner)
DROP POLICY IF EXISTS "Delivery partners can view available orders" ON public.orders;
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
-- Create order_ratings table
CREATE TABLE IF NOT EXISTS public.order_ratings (
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
DROP POLICY IF EXISTS "Customers can view their ratings" ON public.order_ratings;
CREATE POLICY "Customers can view their ratings"
ON public.order_ratings
FOR SELECT
USING (auth.uid() = customer_id);

-- Customers can create ratings for their delivered orders
DROP POLICY IF EXISTS "Customers can rate their delivered orders" ON public.order_ratings;
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
DROP POLICY IF EXISTS "Delivery partners can view their ratings" ON public.order_ratings;
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
DROP POLICY IF EXISTS "Admins can view all ratings" ON public.order_ratings;
CREATE POLICY "Admins can view all ratings"
ON public.order_ratings
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Enable realtime for ratings
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_ratings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_ratings;
  END IF;
END $$;
-- Add delivery_fee column to orders for admin fee tracking
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_fee') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_fee numeric DEFAULT 25;
  END IF;
END $$;

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
-- Create storage bucket for menu item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view menu images
DROP POLICY IF EXISTS "Anyone can view menu images" ON storage.objects;
CREATE POLICY "Anyone can view menu images"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-images');

-- Allow restaurant owners to upload menu images
DROP POLICY IF EXISTS "Restaurant owners can upload menu images" ON storage.objects;
CREATE POLICY "Restaurant owners can upload menu images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'menu-images' AND
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE owner_id = auth.uid()
  )
);

-- Allow restaurant owners to update their menu images
DROP POLICY IF EXISTS "Restaurant owners can update menu images" ON storage.objects;
CREATE POLICY "Restaurant owners can update menu images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'menu-images' AND
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE owner_id = auth.uid()
  )
);

-- Allow restaurant owners to delete their menu images
DROP POLICY IF EXISTS "Restaurant owners can delete menu images" ON storage.objects;
CREATE POLICY "Restaurant owners can delete menu images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'menu-images' AND
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE owner_id = auth.uid()
  )
);
-- Create restaurant reviews table
CREATE TABLE IF NOT EXISTS public.restaurant_reviews (
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
DROP POLICY IF EXISTS "Anyone can view restaurant reviews" ON public.restaurant_reviews;
CREATE POLICY "Anyone can view restaurant reviews"
ON public.restaurant_reviews
FOR SELECT
USING (true);

-- Customers can create reviews for their delivered orders
DROP POLICY IF EXISTS "Customers can create reviews for their orders" ON public.restaurant_reviews;
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
DROP POLICY IF EXISTS "Customers can update their own reviews" ON public.restaurant_reviews;
CREATE POLICY "Customers can update their own reviews"
ON public.restaurant_reviews
FOR UPDATE
USING (auth.uid() = customer_id);

-- Customers can delete their own reviews
DROP POLICY IF EXISTS "Customers can delete their own reviews" ON public.restaurant_reviews;
CREATE POLICY "Customers can delete their own reviews"
ON public.restaurant_reviews
FOR DELETE
USING (auth.uid() = customer_id);

-- Admins can manage all reviews
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.restaurant_reviews;
CREATE POLICY "Admins can manage all reviews"
ON public.restaurant_reviews
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Reviews policies
CREATE POLICY "Users can read all reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Check if rating column exists in restaurants, if not add it
DO e:\foodiempt-main BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'rating') THEN
    ALTER TABLE public.restaurants ADD COLUMN rating DECIMAL(2,1);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'rating_count') THEN
    ALTER TABLE public.restaurants ADD COLUMN rating_count INTEGER DEFAULT 0;
  END IF;
END e:\foodiempt-main;

-- Function to update restaurant rating on new review
CREATE OR REPLACE FUNCTION public.update_restaurant_rating()
RETURNS TRIGGER AS e:\foodiempt-main
BEGIN
  UPDATE public.restaurants
  SET 
    rating = (SELECT AVG(rating)::DECIMAL(2,1) FROM public.reviews WHERE restaurant_id = NEW.restaurant_id),
    rating_count = (SELECT COUNT(*) FROM public.reviews WHERE restaurant_id = NEW.restaurant_id)
  WHERE id = NEW.restaurant_id;
  RETURN NEW;
END;
e:\foodiempt-main LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for rating update
DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_restaurant_rating();

