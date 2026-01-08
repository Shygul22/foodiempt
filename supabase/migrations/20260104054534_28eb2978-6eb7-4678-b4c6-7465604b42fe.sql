-- Create admin-only function to assign any role to users
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  _target_user_id UUID,
  _role app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN FALSE;
  END IF;
  
  -- Insert the role
  INSERT INTO user_roles (user_id, role)
  VALUES (_target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Create admin-only function to remove roles from users
CREATE OR REPLACE FUNCTION public.admin_remove_role(
  _target_user_id UUID,
  _role app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT has_role(auth.uid(), 'super_admin') THEN
    RETURN FALSE;
  END IF;
  
  -- Delete the role
  DELETE FROM user_roles
  WHERE user_id = _target_user_id AND role = _role;
  
  RETURN TRUE;
END;
$$;