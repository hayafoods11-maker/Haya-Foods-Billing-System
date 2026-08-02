/*
# Haya Foods - Auto-create staff on signup (Part 5)

## Purpose
When a new auth user signs up, automatically create a matching `public.staff` row.
The very first staff member becomes the admin; later signups default to 'cashier'
and can be promoted by an admin.

## Security
- Trigger runs as SECURITY DEFINER so it can insert into public.staff regardless of caller role.
- Role is read from raw_user_meta_data (set during signUp) if provided, else 'cashier',
  unless no staff exist yet, in which case the first member is 'admin'.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_count integer;
  requested_role text;
  final_role text;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'cashier');
  SELECT count(*) INTO staff_count FROM public.staff;

  IF staff_count = 0 THEN
    final_role := 'admin';
  ELSE
    final_role := requested_role;
  END IF;

  INSERT INTO public.staff (id, full_name, email, phone, role, active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    final_role,
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
