-- Create delivery_pincodes table
create table if not exists public.delivery_pincodes (
    id uuid not null default gen_random_uuid(),
    pincode text not null,
    description text null,
    is_active boolean not null default true,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint delivery_pincodes_pkey primary key (id),
    constraint delivery_pincodes_pincode_key unique (pincode)
);

-- Add pincode column to customer_addresses
alter table public.customer_addresses 
add column if not exists pincode text;

-- Enable RLS
alter table public.delivery_pincodes enable row level security;

-- Policies for delivery_pincodes
create policy "Delivery pincodes are viewable by everyone"
    on public.delivery_pincodes for select
    using (true);

create policy "Delivery pincodes are manageable by admins only"
    on public.delivery_pincodes for all
    using (
        exists (
            select 1 from public.user_roles
            where user_id = auth.uid()
            and role in ('super_admin')
        )
    );

-- Add indexes
create index if not exists idx_delivery_pincodes_pincode on public.delivery_pincodes(pincode);
