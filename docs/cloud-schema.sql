create table public.modul_studio_projects (
id uuid primary key default gen_random_uuid(),
owner_id uuid not null references auth.users(id) on delete cascade,
name text not null check (char_length(name) between 1 and 100),
schema_version text not null default '0.4',
data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 524288),
area_m2 numeric not null check (area_m2 >= 0),
selected text not null check (selected in ('A','B','C')),
created_at timestamptz not null default now()
);
create index modul_studio_owner_created on public.modul_studio_projects(owner_id,created_at desc);
alter table public.modul_studio_projects enable row level security;
revoke all on public.modul_studio_projects from anon, authenticated;
grant select,insert,delete on public.modul_studio_projects to authenticated;
create policy studio_owner_read on public.modul_studio_projects for select to authenticated using ((select auth.uid())=owner_id);
create policy studio_owner_insert on public.modul_studio_projects for insert to authenticated with check ((select auth.uid())=owner_id);
create policy studio_owner_delete on public.modul_studio_projects for delete to authenticated using ((select auth.uid())=owner_id);
