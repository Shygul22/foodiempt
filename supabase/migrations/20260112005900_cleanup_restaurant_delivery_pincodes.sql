-- Drop all policies first
DROP POLICY IF EXISTS "Restaurant owners can view their own delivery pincodes" ON public.restaurant_delivery_pincodes;
DROP POLICY IF EXISTS "Restaurant owners can insert their own delivery pincodes" ON public.restaurant_delivery_pincodes;
DROP POLICY IF EXISTS "Restaurant owners can update their own delivery pincodes" ON public.restaurant_delivery_pincodes;
DROP POLICY IF EXISTS "Restaurant owners can delete their own delivery pincodes" ON public.restaurant_delivery_pincodes;
DROP POLICY IF EXISTS "Public can view active delivery pincodes" ON public.restaurant_delivery_pincodes;

-- Drop the table
DROP TABLE IF EXISTS public.restaurant_delivery_pincodes CASCADE;
