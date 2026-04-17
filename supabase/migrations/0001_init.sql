create table if not exists public.tiles (
  id bigint primary key,
  x integer not null,
  y integer not null,
  status text not null check (status in ('available', 'reserved', 'sold', 'listed')),
  current_owner_wallet text,
  nft_token_id text unique,
  primary_price_usd numeric(10,2) not null default 100.00,
  current_listing_price_usd numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tile_creatives (
  id bigint generated always as identity primary key,
  tile_id bigint not null references public.tiles(id) on delete cascade,
  title text,
  description text,
  outbound_url text,
  media_url text,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tiles enable row level security;
alter table public.tile_creatives enable row level security;
