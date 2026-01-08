-- Create trigger for generating delivery OTP when order is created
CREATE TRIGGER generate_delivery_otp_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_delivery_otp();

-- Create trigger for generating pickup OTP when order status changes to ready_for_pickup
CREATE TRIGGER generate_pickup_otp_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_pickup_otp();