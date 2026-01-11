-- Add pincode column to restaurants table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'pincode') THEN
    ALTER TABLE public.restaurants ADD COLUMN pincode text;
  END IF;
END $$;
