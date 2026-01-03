-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.generate_order_otps()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate pickup_otp when order becomes confirmed (or preparing/ready_for_pickup if no OTP yet)
  IF NEW.status IN ('confirmed', 'preparing', 'ready_for_pickup') AND OLD.pickup_otp IS NULL THEN
    NEW.pickup_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  
  -- Generate delivery_otp when order is confirmed (or later if no OTP yet)
  IF NEW.status IN ('confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way') AND OLD.delivery_otp IS NULL THEN
    NEW.delivery_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;