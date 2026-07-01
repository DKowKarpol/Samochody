# System rezerwacji auta firmowego

Prosta aplikacja frontendowa do rezerwacji aut.

## Co zawiera

- lista rezerwacji,
- operacje CRUD wykonywalne na rezerwacjach,
- walidacja dat i blokada konfliktów po stronie frontend i SQL Server,
- prosty backend API dla aut i rezerwacji,
- formularz rezerwacji pojedynczej i długoterminowej.

## Uruchomienie

Ten projekt działa z SQL Server.

1. Skonfiguruj plik `.env` w katalogu głównym projektu na podstawie `./.env.example`.
2. Zainstaluj zależności backendu:
   - `npm install`
3. Uruchom backend:
   - `npm start`
4. W innym terminalu uruchom serwer statyczny:
   - `python -m http.server 5500`
5. Otwórz przeglądarkę:
   - `http://localhost:5500`

## Backend SQL Server

Backend nasłuchuje na `http://localhost:3000` i udostępnia API:

- `GET /api/cars`
- `GET /api/reservations`
- `POST /api/reservations`
- `PATCH /api/reservations/:id/time`
- `PATCH /api/reservations/:id`
- `DELETE /api/reservations/:id`
- `POST /api/reservations/conflict`

## Konfiguracja połączenia SQL Server

W pliku `.env` ustaw:

- `MSSQL_USER`
- `MSSQL_PASSWORD`
- `MSSQL_HOST`
- `MSSQL_PORT`
- `MSSQL_DATABASE`
- `MSSQL_ENCRYPT` (true/false)
- `MSSQL_TRUST_CERT` (true/false)

## Schemat bazy

Schemat SQL Server znajduje się w `supabase/schema.sql` oraz w `db_schema/schema.sql` jako kopia zapasowa.


