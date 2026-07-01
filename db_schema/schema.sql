if object_id('dbo.trg_reservation_conflict', 'TR') is not null
  drop trigger dbo.trg_reservation_conflict;

if object_id('dbo.Reservations', 'U') is not null
  drop table dbo.Reservations;

if object_id('dbo.Cars', 'U') is not null
  drop table dbo.Cars;

create table dbo.Cars (
  id int not null primary key,
  name nvarchar(255) not null unique
);

create table dbo.Reservations (
  id int identity(1,1) not null primary key,
  car_id int not null,
  user_name nvarchar(255) not null,
  start_time datetime2 not null,
  end_time datetime2 not null,
  uwagi nvarchar(max) null,
  constraint FK_Reservations_Cars foreign key (car_id) references dbo.Cars(id),
  constraint CK_Reservations_TimeValid check (start_time < end_time)
);

go

create trigger dbo.trg_reservation_conflict
on dbo.Reservations
after insert, update
as
begin
  set nocount on;

  if exists (
    select 1
    from inserted i
    join dbo.Reservations r
      on r.car_id = i.car_id
     and r.id <> i.id
     and r.start_time < i.end_time
     and r.end_time > i.start_time
  )
  begin
    throw 50001, N'Konflikt rezerwacji dla wybranego auta.', 1;
  end;
end;
go

insert into dbo.Cars (id, name)
select 1, N'Passat' where not exists (select 1 from dbo.Cars where id = 1);
insert into dbo.Cars (id, name)
select 2, N'Caddy' where not exists (select 1 from dbo.Cars where id = 2);
insert into dbo.Cars (id, name)
select 3, N'Tiguan' where not exists (select 1 from dbo.Cars where id = 3);
insert into dbo.Cars (id, name)
select 4, N'Crafter' where not exists (select 1 from dbo.Cars where id = 4);
insert into dbo.Cars (id, name)
select 5, N'Sprinter' where not exists (select 1 from dbo.Cars where id = 5);
