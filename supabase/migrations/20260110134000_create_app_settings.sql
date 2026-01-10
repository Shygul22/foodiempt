-- Create app_settings table
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.app_settings enable row level security;

-- Policies
create policy "Allow public read access"
  on public.app_settings
  for select
  to public
  using (true);

create policy "Allow admin all access"
  on public.app_settings
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role = 'super_admin'
    )
  );

-- Insert default value
insert into public.app_settings (key, value)
values ('enable_phone_login', 'true'::jsonb)
on conflict (key) do nothing;
