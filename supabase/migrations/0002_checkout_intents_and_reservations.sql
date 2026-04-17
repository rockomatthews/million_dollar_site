alter table public.tiles
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists last_checkout_intent_id uuid;

create table if not exists public.checkout_intents (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  tile_ids bigint[] not null,
  tile_count integer not null,
  amount_usd numeric(10,2) not null,
  amount_usdc numeric(10,6),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  provider text,
  provider_reference text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_intents_wallet_address_idx
  on public.checkout_intents (wallet_address);

create index if not exists checkout_intents_status_idx
  on public.checkout_intents (status);

alter table public.checkout_intents enable row level security;
