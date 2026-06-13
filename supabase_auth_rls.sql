-- Run this in Supabase SQL Editor AFTER creating your admin user
-- This locks down all tables so only logged-in users can access them

-- Drop old public policies
drop policy if exists "public" on ub_drivers;
drop policy if exists "public" on ub_dispatch;
drop policy if exists "public" on ub_week_days;
drop policy if exists "public" on ub_meta;

-- New policies: only authenticated users can read/write
create policy "authenticated" on ub_drivers   for all to authenticated using (true) with check (true);
create policy "authenticated" on ub_dispatch  for all to authenticated using (true) with check (true);
create policy "authenticated" on ub_week_days for all to authenticated using (true) with check (true);
create policy "authenticated" on ub_meta      for all to authenticated using (true) with check (true);
