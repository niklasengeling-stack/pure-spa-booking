# CLAUDE.md — Kontext & Arbeitsregeln für Claude Code

> Diese Datei wird von Claude Code automatisch als Projektgedächtnis gelesen.
> Sie ist die einzige Quelle der Wahrheit für den Kontext. Bei Widersprüchen
> zwischen Code und dieser Datei: nachfragen.

## Was wir bauen

Ein **eigenständiges Buchungstool für PURE SPA** (Wellnessunternehmen, Standorte
**Dortmund** und **Oberhausen**). Es läuft getrennt von der Webseite und sitzt
**vor** dem bestehenden Spa-System **TAC „Reservation Assistant"**.

- **TAC bleibt das führende System**: Räume, Personal, Suiten, Abrechnung, 200+ Schnittstellen.
- Das Tool **liest Verfügbarkeit in Echtzeit aus TAC** und **schreibt Buchungen nach TAC zurück**.
- Wir stellen TAC **keine** API bereit — wir **konsumieren** TACs Schnittstelle und
  legen eine eigene, saubere Fassade davor.

## Goldene Regeln (immer beachten)

1. **`shared/types.ts` ist der Vertrag.** Nicht ohne Rückfrage ändern.
2. **Alle TAC-Logik bleibt im `RealTacAdapter` gekapselt.** Frontend, Routen und Cache
   kennen nur das Interface `TacAdapter` — niemals TAC direkt.
3. **Alle Bezahl-Logik bleibt im `PaymentAdapter`.** Ziel ist **TAC|Pay (Option A)**.
4. **Niemals Kartendaten selbst entgegennehmen oder eingeben.** Das macht der
   gehostete TAC|Pay-Checkout. So bleiben wir außerhalb des PCI-Scopes.
5. **Kein Scraping des TAC-Webshops.** Datenzugang ausschließlich über die offizielle
   TAC-Schnittstelle (Freigabe läuft über PureSpa als Vertragskunde).
6. **Der Mock-Modus muss immer lauffähig bleiben.** Er ist der Standard und die
   Grundlage für die Weiterentwicklung ohne TAC-Zugang.
7. Deutsch als UI- und Doku-Sprache.

## Architektur

```
Frontend (React/Vite)  →  Backend-Fassade (Express + TTL-Cache)  →  TacAdapter  →  TAC
Bezahlung:  Frontend   →  PaymentAdapter  →  TAC|Pay
```

Adapter werden per Umgebungsvariable gewählt (`backend/.env`):

- `TAC_MODE=mock|real`     → `MockTacAdapter` (Standard) bzw. `RealTacAdapter`
- `PAYMENT_MODE=onsite|tacpay` → `PayOnSiteAdapter` (Standard, Pilot) bzw. `TacPayAdapter`

Wenn TAC sein Interface ändert, wird **nur** der jeweilige Adapter angefasst.

## Projektstruktur (wichtige Dateien)

```
shared/types.ts                         # Vertrag zwischen allen Teilen
backend/src/
  server.ts                             # Express-App, wählt Adapter per ENV
  cache.ts                              # TTL-Cache (Echtzeit-Gefühl + Rate-Limit-Schutz)
  routes/booking.ts                     # Fassade: locations/suites/availability/slots/bookings
  routes/payment.ts                     # Fassade: checkout/status/webhook
  adapters/TacAdapter.ts                # Interface  ← Naht zu TAC
  adapters/MockTacAdapter.ts            # aktiv: echte Katalog-IDs + Dummy-Verfügbarkeit
  adapters/RealTacAdapter.ts            # später befüllen (TAC-Spezifikation nötig)
  payments/PaymentAdapter.ts            # Interface  ← Naht zur Bezahlung
  payments/PayOnSiteAdapter.ts          # aktiv: vor Ort zahlen (Pilot)
  payments/TacPayAdapter.ts             # später befüllen (TAC|Pay-Freigabe nötig)
frontend/src/{App.tsx, api.ts, main.tsx}
```

## Eigene API (die Fassade vor TAC)

| Methode | Pfad                       | Zweck                                   |
|---------|----------------------------|-----------------------------------------|
| GET     | `/api/locations`           | Standorte                               |
| GET     | `/api/suites`              | Suiten je Standort                      |
| GET     | `/api/availability`        | Tagesstatus für die Kalender-Einfärbung |
| GET     | `/api/slots`               | Zeitslots eines Tages                   |
| POST    | `/api/bookings`            | Buchung anlegen (schreibt nach TAC)     |
| POST    | `/api/checkout`            | Bezahlvorgang starten                   |
| GET     | `/api/checkout/:paymentId` | Zahlungsstatus                          |
| POST    | `/api/payment/webhook`     | TAC|Pay-Ergebnis (nur `tacpay`)         |

Kalender-Status pro Tag: `available` (blau, klickbar) · `soldout` (ausgebucht) ·
`closed` (Vergangenheit/geschlossen).

## TAC-Katalog-Mapping (aus dem Live-Shop, Standort Dortmund)

Eine Buchung ist in TAC über **Kategorie (Personen) × Template (Dauer)** definiert.
Diese realen IDs nutzt der `MockTacAdapter` bereits.

| Gäste | TAC categoryId |   | Dauer | TAC templateId | Preis  |
|------:|:--------------:|---|------:|:--------------:|:------:|
| 2 P   | 480            |   | 2 Std | 489            | 98 €   |
| 3 P   | 481            |   | 3 Std | 490            | 147 €  |
| 4 P   | 482            |   | 4 Std | 491            | 196 €  |
|       |                |   | 5 Std | 492            | 245 €  |
|       |                |   | 6 Std | 493            | 288 €  |

- Preise sind **nicht linear** (6 Std = 288 €, nicht 294 €) → als Tabelle pflegen.
- IDs gelten für **Dortmund**. **Oberhausen** ist ein eigener Shop mit eigenen IDs (TBD).
- Der aktuelle TAC-Shop kennt **keinen Suiten-Filter** (nur Personen × Dauer).
  Der „Suite"-Filter im neuen Design ist neu → muss in TAC auf etwas abgebildet
  werden (z. B. Räume/Ressourcen). Mit TAC klären.

## Status

**Fertig:** Konzept & UX-Design · klickbarer Prototyp · `MockTacAdapter` (echter Katalog) ·
`PaymentAdapter`-Naht mit `PayOnSiteAdapter` · `shared/types`.

**Offen:** `RealTacAdapter` · `TacPayAdapter` · Checkout-Flow im Frontend · Login ·
Tests · Oberhausen-IDs · Suiten-Mapping.

## Nächste Aufgaben (priorisiert)

1. **Checkout-Flow im Frontend**: Slot anklicken → Gästedaten-Formular →
   `POST /api/checkout`. Bei `onsite` danach `POST /api/bookings` (Reservierung in TAC).
   Bei `tacpay` zur `checkoutUrl` weiterleiten.
2. **Login** (oben rechts im Design) — prüfen, ob TAC Kundendaten liefert oder ein
   eigener Account-Layer nötig ist.
3. **Tests** für `TacAdapter`/`PaymentAdapter` gegen die Interfaces (Mock).
4. **Sobald TAC-Doku vorliegt:** `RealTacAdapter` befüllen (`TAC_MODE=real`),
   danach `TacPayAdapter` (`PAYMENT_MODE=tacpay`). Nur diese Dateien ändern.

## Offene Fragen an TAC (über PureSpa, office@tac.eu.com)

- Gibt es ein **Realtime-Availability- und ein Booking-Interface** für externe Kanäle?
  Protokoll (REST/JSON, SOAP?), Authentifizierung, Sandbox, **Rate-Limits**.
- Ist **TAC|Pay aus einem externen Buchungskanal** nutzbar? Endpunkte, Webhook, Signatur.
- **Oberhausen**: category-/template-IDs.
- Worauf mappt der **„Suite"-Filter** in TAC?
- Bei der Anfrage die konkreten Dortmund-IDs (oben) nennen.

## Lokal starten

```bash
# Terminal 1 – Backend (Mock + onsite, kein TAC-Zugang nötig)
cd backend && npm install && cp .env.example .env && npm run dev   # http://localhost:3001

# Terminal 2 – Frontend
cd frontend && npm install && npm run dev                          # http://localhost:5173
```

Für den vollständigen Look `frontend/public/hero.jpg` und `logo.svg` ablegen.

## Tech-Stack

React 18 + Vite + TypeScript · Tailwind (im Scaffold via CDN; für Prod auf echten
Build umstellen) · Express + TypeScript · `tsx` für Dev.

## Weiterführend

- `README.md` — Setup & Überblick
- `ARCHITECTURE.md` — Datenfluss, Caching, Bezahlung (TAC|Pay), offene Punkte
