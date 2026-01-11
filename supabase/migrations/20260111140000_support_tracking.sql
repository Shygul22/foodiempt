-- 1. Allow support_agent to view all profiles (Fixes "Unknown" Name)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'support_agent')
  );

-- 2. Add assignment tracking to tickets
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id);

-- 3. No extra policy changes needed for support_tickets as "Staff can update all tickets" 
-- was already added in the previous migration and covers updating this new column.
