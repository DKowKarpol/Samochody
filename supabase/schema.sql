create table if not exists public."Cars" (
  id bigint primary key,
  name text not null unique
);

create table if not exists public."Reservations" (
  id bigint generated always as identity primary key,
  car_id bigint not null references public."Cars"(id),
  user_name text not null,
  start_time timestamp not null,
  end_time timestamp not null,
  uwagi text
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'Reservations'
      and c.conname = 'reservations_time_valid'
  ) then
    alter table public."Reservations"
      add constraint reservations_time_valid check (start_time < end_time);
  end if;
end $$;

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

insert into public."Cars"(id, name)
values
  (1, 'Passat'),
  (2, 'Caddy'),
  (3, 'Tiguan'),
  (4, 'Crafter'),
  (5, 'Sprinter')
on conflict (id) do update set name = excluded.name;
