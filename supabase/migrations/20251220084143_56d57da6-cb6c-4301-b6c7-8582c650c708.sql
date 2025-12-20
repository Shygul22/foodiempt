-- Add pickup OTP to orders for restaurant-to-delivery handoff
ALTER TABLE public.orders 
ADD COLUMN pickup_otp text;

-- Add phone and verified status to delivery_partners
ALTER TABLE public.delivery_partners 
ADD COLUMN phone text,
ADD COLUMN phone_verified boolean NOT NULL DEFAULT false,
ADD COLUMN verification_otp text;

-- Create function to generate pickup OTP when order is ready
CREATE OR REPLACE FUNCTION public.generate_pickup_otp()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate pickup OTP when status changes to ready_for_pickup
  IF NEW.status = 'ready_for_pickup' AND (OLD.status IS NULL OR OLD.status != 'ready_for_pickup') THEN
    NEW.pickup_otp = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for pickup OTP
CREATE TRIGGER generate_pickup_otp_on_ready
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_pickup_otp();