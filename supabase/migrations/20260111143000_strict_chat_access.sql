-- Update policy for support_messages to restrict INSERT (Chatting)
-- Only allow if:
-- 1. Super Admin
-- 2. Ticket Owner (Customer)
-- 3. Assigned Support Agent

DROP POLICY IF EXISTS "Staff can create messages" ON public.support_messages;

CREATE POLICY "Authorized users can chat" ON public.support_messages
  FOR INSERT WITH CHECK (
    -- 1. Super Admin
    public.has_role(auth.uid(), 'super_admin') 
    OR 
    -- 2. Ticket Owner (checked via join to support_tickets usually, but here we can trust the ticket_id if we verify ownership)
    -- Actually, for customers, we need to check if they own the ticket
    EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_id 
        AND st.user_id = auth.uid()
    )
    OR
    -- 3. Assigned Support Agent
    EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_id 
        AND st.assigned_to = auth.uid()
        AND public.has_role(auth.uid(), 'support_agent')
    )
  );

-- Also update View policy to enable reading for assigned agents
DROP POLICY IF EXISTS "Staff can view all messages" ON public.support_messages;
CREATE POLICY "Authorized users can view messages" ON public.support_messages
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin') 
    OR
    -- Ticket Owner
    EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_id 
        AND st.user_id = auth.uid()
    )
    OR
    -- Assigned Support Agent (or if they are support agent and need to see history before claiming? 
    -- Usually better to allow view all for context, but user requested strictness)
    -- "particukar to user only allow... not eveyone"
    -- Let's restrict VIEW to assigned agents only + Unassigned (so they can decide to claim)
    (
        public.has_role(auth.uid(), 'support_agent')
        AND
        EXISTS (
            SELECT 1 FROM public.support_tickets st
            WHERE st.id = ticket_id 
            AND (st.assigned_to = auth.uid() OR st.assigned_to IS NULL)
        )
    )
  );
