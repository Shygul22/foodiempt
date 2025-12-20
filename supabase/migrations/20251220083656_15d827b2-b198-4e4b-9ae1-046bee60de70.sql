-- Add payment method and OTP fields to orders table
ALTER TABLE public.orders 
ADD COLUMN payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'gpay')),
ADD COLUMN delivery_otp text;

-- Create function to generate 4-digit OTP
CREATE OR REPLACE FUNCTION public.generate_delivery_otp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.delivery_otp = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate OTP on order creation
CREATE TRIGGER generate_otp_on_order_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_delivery_otp();