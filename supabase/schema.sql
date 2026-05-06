create extension if not exists pgcrypto with schema extensions;

alter table public.users add column if not exists login text;
alter table public.users add column if not exists password_hash text;

update public.users
set login = coalesce(login, lower(name))
where login is null;

update public.users
set password_hash = extensions.crypt('admin123', extensions.gen_salt('bf'))
where password_hash is null;

update public.users
set password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf'))
where password_hash is not null
  and password_hash not like '$2%';

alter table public.users alter column login set not null;
alter table public.users alter column password_hash set not null;

create unique index if not exists users_login_unique_idx on public.users(lower(login));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_time_valid'
      and conrelid = 'public."Reservations"'::regclass
  ) then
    alter table public."Reservations"
      add constraint reservations_time_valid check (start_time < end_time);
  end if;
end $$;

alter table public."Reservations" add column if not exists uwagi text;

create or replace function public.check_reservation_conflict()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public."Reservations" r
    where r.car_id = new.car_id
      and r.id <> coalesce(new.id, -1)
      and r.start_time < new.end_time
      and r.end_time > new.start_time
  ) then
    raise exception 'Konflikt rezerwacji dla wybranego auta.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservation_conflict on public."Reservations";
create trigger trg_reservation_conflict
before insert or update on public."Reservations"
for each row execute function public.check_reservation_conflict();

create or replace function public.app_login(p_login text, p_password text)
returns table(id bigint, login text, name text, role text)
language sql
security definer
set search_path = public
as $$
  select u.id, u.login, u.name, u.role
  from public.users u
  where lower(u.login) = lower(trim(p_login))
    and u.password_hash = extensions.crypt(p_password, u.password_hash)
  limit 1;
$$;

create or replace function public.app_ensure_admin(p_password text default 'admin123')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_id bigint;
begin
  select id into admin_id
  from public.users
  where lower(login) = 'admin'
  order by id
  limit 1;

  if admin_id is null then
    insert into public.users(login, name, role, password_hash)
    values (
      'admin',
      'Administrator',
      'admin',
      extensions.crypt(p_password, extensions.gen_salt('bf'))
    )
    returning id into admin_id;
  else
    update public.users
    set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
    where id = admin_id
      and (password_hash is null or password_hash not like '$2%');
  end if;

  return admin_id;
end;
$$;

create or replace function public.assert_admin(p_actor_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  select role into actor_role from public.users where id = p_actor_id;
  if actor_role is distinct from 'admin' then
    raise exception 'Brak uprawnień admin.';
  end if;
end;
$$;

create or replace function public.app_create_user(
  p_actor_id bigint,
  p_login text,
  p_name text,
  p_role text,
  p_password text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id bigint;
begin
  perform public.assert_admin(p_actor_id);
  if p_role not in ('admin', 'user', 'portiernia') then
    raise exception 'Niepoprawna rola.';
  end if;
  if length(trim(p_password)) < 6 then
    raise exception 'Hasło musi mieć minimum 6 znaków.';
  end if;

  insert into public.users(login, name, role, password_hash)
  values (
    lower(trim(p_login)),
    trim(p_name),
    p_role,
    extensions.crypt(p_password, extensions.gen_salt('bf'))
  )
  returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.app_set_user_role(
  p_actor_id bigint,
  p_target_user_id bigint,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin(p_actor_id);
  if p_role not in ('admin', 'user', 'portiernia') then
    raise exception 'Niepoprawna rola.';
  end if;
  update public.users set role = p_role where id = p_target_user_id;
end;
$$;

create or replace function public.app_set_user_password(
  p_actor_id bigint,
  p_target_user_id bigint,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin(p_actor_id);
  if length(trim(p_password)) < 6 then
    raise exception 'Hasło musi mieć minimum 6 znaków.';
  end if;
  update public.users
  set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
  where id = p_target_user_id;
end;
$$;

create or replace function public.app_delete_user(
  p_actor_id bigint,
  p_target_user_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin(p_actor_id);
  if p_actor_id = p_target_user_id then
    raise exception 'Nie można usunąć aktualnie zalogowanego admina.';
  end if;
  delete from public.users where id = p_target_user_id;
end;
$$;

create or replace function public.app_delete_reservation(
  p_actor_id bigint,
  p_reservation_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  owner_id bigint;
begin
  select role into actor_role from public.users where id = p_actor_id;
  select user_id into owner_id from public."Reservations" where id = p_reservation_id;

  if owner_id is null then
    raise exception 'Rezerwacja nie istnieje.';
  end if;

  if actor_role in ('admin', 'portiernia') or owner_id = p_actor_id then
    delete from public."Reservations" where id = p_reservation_id;
  else
    raise exception 'Brak uprawnień do usunięcia tej rezerwacji.';
  end if;
end;
$$;

alter table public.users disable row level security;
alter table public."Cars" disable row level security;
alter table public."Reservations" disable row level security;

insert into public."Cars"(id, name)
values
  (1, 'Passat'),
  (2, 'Caddy'),
  (3, 'Tiguan'),
  (4, 'Crafter'),
  (5, 'Sprinter')
on conflict (id) do update set name = excluded.name;
