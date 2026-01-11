-- Add locality column to restaurants and customer_addresses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'locality') THEN
    ALTER TABLE public.restaurants ADD COLUMN locality text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customer_addresses' AND column_name = 'locality') THEN
    ALTER TABLE public.customer_addresses ADD COLUMN locality text;
  END IF;
END $$;
