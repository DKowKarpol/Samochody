# System rezerwacji auta firmowego

Prosta aplikacja frontendowa do rezerwacji aut.

## Co zawiera

- lista rezerwacji,
- operacje CRUD wtkonywalne na rezerwacjach,
- walidacja dat i blokada konfliktów (frontend + trigger SQL),
- historia zmian rezerwacji (`reservation_history`),
- realtime dla `reservations`.

## Uruchomienie

Ten projekt może działać z SQL Server lub Supabase. Użyj  pliku `supabase/schema.sql` do utworzenia tabel i struktur i połącz się z SQL Server w backendzie lub odpowiednio z Supabase.

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


