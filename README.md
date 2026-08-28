# System rezerwacji auta firmowego

Prosta aplikacja frontendowa oparta o Supabase.

## Co zawiera

- lista rezerwacji,
- operacje CRUD wykonywalne na rezerwacjach,
- walidacja dat i blokada konfliktów po stronie frontend i triggera SQL,
- bezpośrednie operacje na Supabase dla aut i rezerwacji,
- formularz rezerwacji pojedynczej i długoterminowej.

## Uruchomienie

1. W Supabase uruchom SQL z pliku `./supabase/schema.sql`.
2. W katalogu projektu uruchom serwer statyczny:
   - `python -m http.server 5500`
3. Otwórz przeglądarkę:
   - `http://localhost:5500`

## Wdrożenie na Vercel

Projekt jest statyczną aplikacją. Zaimportuj repozytorium w Vercel i wybierz preset `Other`.
Pozostaw `Build Command` puste. Plik `index.html` jest punktem wejścia aplikacji.

## Schemat bazy

Konfiguracja klienta Supabase znajduje się w `src/config.js`.

## Działanie

System umożliwia dodawanie rezerwacji aut wybieranych z listy rozwijanej w określonym czasie. 
Dostępne są:
- rezerwacje zwykłe(widoczne po wejściu na stronę),
- rezerwacje szybkie(rezerwacja auta na 15 minut bez podawania zakresu czasowego)
- rezerwacje długoterminowe(wykonujące rezerwację na więcej niż jeden dzień w danych godzinach)