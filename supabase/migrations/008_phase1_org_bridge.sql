-- ─────────────────────────────────────────────
-- PHASE 1 BRIDGE: Minimal org layer so new tables work
-- Full organizations feature is Phase 8.
-- For now: each admin gets a personal organization; their organization_id
-- is stored on user_profiles so RLS on new tables can resolve it.
-- ─────────────────────────────────────────────

-- Add organization_id to user_profiles (nullable for now; set on first reservation)
alter table user_profiles
  add column if not exists organization_id uuid;

-- Create minimal organization_members stub so RLS on new tables compiles
-- (full table is Phase 8 — this is a minimal bridge row)
create table if not exists organization_members (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'owner'
                  check (role in ('owner', 'admin', 'manager', 'viewer')),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_org_members_user on organization_members(user_id);
create index if not exists idx_org_members_org on organization_members(organization_id);

alter table organization_members enable row level security;

create policy "org_members_select_own" on organization_members
  for select using (user_id = auth.uid());

-- Helper function: get org_id for current user (used by API routes)
create or replace function get_current_user_org_id()
returns uuid
language sql
stable
security definer
as $$
  select organization_id from user_profiles where id = auth.uid() limit 1
$$;

-- Auto-provision an organization_id for existing admin users
-- Uses their user ID as organization UUID (deterministic, no collisions)
do $$
declare
  r record;
begin
  for r in select id from user_profiles where organization_id is null loop
    update user_profiles
      set organization_id = r.id
    where id = r.id;

    -- Create an org_members row so RLS policies resolve
    insert into organization_members (organization_id, user_id, role)
    values (r.id, r.id, 'owner')
    on conflict (organization_id, user_id) do nothing;
  end loop;
end;
$$;

-- Ensure new users also get an org_id on profile creation
create or replace function handle_new_user_org()
returns trigger as $$
begin
  -- Set organization_id = user id (personal org for Phase 1)
  update public.user_profiles
    set organization_id = new.id
  where id = new.id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger fires after handle_new_user (which creates the profile row)
create trigger on_user_profile_created
  after insert on public.user_profiles
  for each row execute procedure handle_new_user_org();
