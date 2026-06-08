-- Schema configuration for Kauan Lens Portfolio
-- Conforming to Supabase & Postgres Best Practices

-- 1. Create Albums Table
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  date date not null,
  local text,
  cat text,
  note text,
  status text not null default 'draft', -- draft | published
  sort_order integer not null default 0,
  cover_url text,
  is_featured boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable RLS on albums
alter table public.albums enable row level security;
alter table public.albums force row level security;

-- Create policies for albums
-- Anonymous users can only view published and non-deleted albums
create policy "Allow public read-only access to published albums"
  on public.albums
  for select
  to anon, authenticated
  using (status = 'published' and deleted_at is null);

-- Authenticated admins can do anything (including view draft/deleted albums)
create policy "Allow authenticated users to select all albums"
  on public.albums
  for select
  to authenticated
  using (true);

create policy "Allow authenticated users to manage albums"
  on public.albums
  for all
  to authenticated
  using (true)
  with check (true);


-- 2. Create Photos Table
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  src text not null,          -- Web-optimized URL
  thumbnail_src text not null,-- Thumbnail URL
  original_src text not null, -- Original high-res URL
  name text,
  w integer,
  h integer,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index foreign key to optimize JOINs and CASCADE operations (High Impact rule)
create index photos_album_id_idx on public.photos (album_id);

-- Enable RLS on photos
alter table public.photos enable row level security;
alter table public.photos force row level security;

-- Create policies for photos
-- Anonymous users can only view non-deleted photos that belong to published/active albums
create policy "Allow public read-only access to active photos"
  on public.photos
  for select
  to anon, authenticated
  using (
    deleted_at is null and
    exists (
      select 1 from public.albums
      where id = photos.album_id and status = 'published' and deleted_at is null
    )
  );

-- Authenticated admins can do anything
create policy "Allow authenticated users to select all photos"
  on public.photos
  for select
  to authenticated
  using (true);

create policy "Allow authenticated users to manage photos"
  on public.photos
  for all
  to authenticated
  using (true)
  with check (true);


-- 3. Create Admin Logs Table
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

-- Enable RLS on admin_logs
alter table public.admin_logs enable row level security;
alter table public.admin_logs force row level security;

-- Only authenticated administrators can read/write logs
create policy "Allow authenticated users to manage logs"
  on public.admin_logs
  for all
  to authenticated
  using (true)
  with check (true);


-- 4. Storage Configuration for Photos Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Storage policies for the public 'photos' bucket
create policy "Allow public read-only access to photos storage"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'photos');

create policy "Allow authenticated users to upload photos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'photos');

create policy "Allow authenticated users to update/delete photos"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');
