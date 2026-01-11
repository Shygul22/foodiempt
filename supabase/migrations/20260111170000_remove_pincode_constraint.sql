-- Remove unique constraint from pincode column in delivery_pincodes table
alter table public.delivery_pincodes
drop constraint if exists delivery_pincodes_pincode_key;
