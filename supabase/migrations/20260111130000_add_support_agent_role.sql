-- Add 'support_agent' to app_role enum
-- PostgreSQL doesn't support IF NOT EXISTS for enum values directly in a simple way that is transaction safe usually,
-- but since we are running this manually or via a tool, we will try to add it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_agent';

-- Update policies for support_tickets to include support_agent
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
CREATE POLICY "Staff can view all tickets" ON public.support_tickets
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'support_agent')
  );

DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
CREATE POLICY "Staff can update all tickets" ON public.support_tickets
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'support_agent')
  );

-- Update policies for support_messages to include support_agent
DROP POLICY IF EXISTS "Admins can view all messages" ON public.support_messages;
CREATE POLICY "Staff can view all messages" ON public.support_messages
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'support_agent')
  );

DROP POLICY IF EXISTS "Admins can create messages" ON public.support_messages;
CREATE POLICY "Staff can create messages" ON public.support_messages
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'support_agent')
  );

-- Helper function to assign support_agent role (SECURE RPC)
CREATE OR REPLACE FUNCTION public.assign_support_role(target_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Check if executing user is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super_admins can assign support roles';
  END IF;

  -- Find user by email
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'support_agent')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
