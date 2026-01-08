-- Add lat/lng columns to restaurants table for location-based filtering
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS lat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lng NUMERIC DEFAULT NULL;

-- Add index for location queries
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON public.restaurants (lat, lng);

-- Comment for clarity
COMMENT ON COLUMN public.restaurants.lat IS 'Latitude coordinate for shop location';
COMMENT ON COLUMN public.restaurants.lng IS 'Longitude coordinate for shop location';