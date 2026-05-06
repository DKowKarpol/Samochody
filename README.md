# System rezerwacji auta firmowego

Prosta aplikacja frontendowa oparta o Supabase Auth + RLS.

## Co zawiera

- logowanie i rejestracja użytkowników (`auth.users`),
- automatyczne tworzenie profilu w tabeli `public.users`,
- automatyczne ustawienie pierwszego zarejestrowanego użytkownika jako `admin`,
- role: `admin`, `user`, `portiernia`,
- lista i dodawanie rezerwacji,
- walidacja dat i blokada konfliktów (frontend + trigger SQL),
- widoki zależne od roli,
- zarządzanie użytkownikami i autami dla admina,
- historia zmian rezerwacji (`reservation_history`),
- realtime dla `reservations`.

## Uruchomienie

1. W Supabase uruchom SQL z pliku `supabase/schema.sql`.
2. W katalogu projektu uruchom serwer statyczny, np.:
   - `python -m http.server 5500`
3. Otwórz przeglądarkę:
   - `http://localhost:5500`

## Konto startowe

- email: `admin@cars.local`
- hasło: `admin123`

Konto tworzy się automatycznie przy pierwszym uruchomieniu aplikacji.
