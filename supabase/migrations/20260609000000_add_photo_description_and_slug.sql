-- Add description column safely
alter table public.photos add column if not exists description text;

-- Add slug column safely
alter table public.photos add column if not exists slug text;

-- Fill existing null slugs uniquely using their UUID and sort_order
update public.photos set slug = 'photo-' || substring(id::text, 1, 8) || '-' || sort_order where slug is null;

-- Add unique constraint idempotently using a PL/pgSQL block
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'photos_slug_key'
  ) then
    alter table public.photos add constraint photos_slug_key unique (slug);
  end if;
end $$;
