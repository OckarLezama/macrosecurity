-- MACRO SECURITY · esquema para Supabase
-- Pegar completo en Supabase → SQL Editor → Run.

-- Todo se guarda como documentos por cliente y colección (config, eventos, unidades, historial, vigiladas, contactos, presets)
create table if not exists public.docs (
  cliente    text        not null,
  col        text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (cliente, col, id)
);

-- Qué usuario (operador) pertenece a qué cliente
create table if not exists public.miembros (
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente text not null,
  rol     text not null default 'operador',   -- operador | supervisor | admin
  primary key (user_id, cliente)
);

-- Turno de quién genera la demostración (evita que dos pantallas dupliquen)
create table if not exists public.leases (
  cliente text not null,
  name    text not null,
  holder  text not null,
  expires timestamptz not null,
  primary key (cliente, name)
);

alter table public.docs     enable row level security;
alter table public.miembros enable row level security;
alter table public.leases   enable row level security;

-- Cada operador solo ve y modifica los datos de su(s) cliente(s)
create or replace function public.es_miembro(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros m where m.user_id = auth.uid() and m.cliente = c);
$$;

drop policy if exists docs_rw on public.docs;
create policy docs_rw on public.docs for all to authenticated
  using (public.es_miembro(cliente)) with check (public.es_miembro(cliente));

drop policy if exists miembros_self on public.miembros;
create policy miembros_self on public.miembros for select to authenticated using (user_id = auth.uid());

drop policy if exists leases_rw on public.leases;
create policy leases_rw on public.leases for all to authenticated
  using (public.es_miembro(cliente)) with check (public.es_miembro(cliente));

create or replace function public.acquire_lease(p_cliente text, p_name text, p_holder text, p_ttl_ms int)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if not public.es_miembro(p_cliente) then return false; end if;
  insert into public.leases(cliente, name, holder, expires)
    values (p_cliente, p_name, p_holder, now() + make_interval(secs => p_ttl_ms / 1000.0))
  on conflict (cliente, name) do update
    set holder = excluded.holder, expires = excluded.expires
    where leases.expires < now() or leases.holder = excluded.holder
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- Tiempo real
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
alter table public.docs replica identity full;

-- Para dar acceso a un operador (después de crearlo en Authentication → Users):
-- insert into public.miembros(user_id, cliente, rol)
--   select id, 'puebla', 'admin' from auth.users where email = 'correo@ejemplo.com';
