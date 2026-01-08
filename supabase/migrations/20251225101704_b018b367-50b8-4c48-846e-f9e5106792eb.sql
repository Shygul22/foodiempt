-- Add category support to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'food';

-- Create enum for shop categories
CREATE TYPE shop_category AS ENUM ('food', 'grocery', 'fruits', 'vegetables', 'meat', 'medicine', 'bakery', 'beverages');

-- Create customer addresses table
CREATE TABLE public.customer_addresses (
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
CREATE POLICY "Users can view their own addresses" 
ON public.customer_addresses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own addresses" 
ON public.customer_addresses 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses" 
ON public.customer_addresses 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses" 
ON public.customer_addresses 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create favourite shops table
CREATE TABLE public.favourite_shops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- Enable RLS for favourite shops
ALTER TABLE public.favourite_shops ENABLE ROW LEVEL SECURITY;

-- RLS policies for favourite shops
CREATE POLICY "Users can view their favourites" 
ON public.favourite_shops 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favourites" 
ON public.favourite_shops 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favourites" 
ON public.favourite_shops 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add scheduled delivery to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;

-- Create trigger for customer_addresses updated_at
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();