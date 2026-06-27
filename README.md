# PureSpa · Buchungstool

Eigenständiges Buchungstool für PureSpa, das die Verfügbarkeit in **Echtzeit aus
TAC ("Reservation Assistant")** liest und Buchungen nach TAC zurückschreibt.
TAC bleibt das führende System (Räume, Personal, Suiten). Dieses Tool ist ein
zusätzlicher Buchungskanal davor.

## Architektur in einem Satz

```
Frontend (React)  ─▶  Backend-Fassade (Express + Cache)  ─▶  TacAdapter  ─▶  TAC
```

Das Frontend spricht **nie** direkt mit TAC, sondern nur mit der eigenen
Backend-API. Die gesamte TAC-Logik steckt hinter **einem** Interface
(`TacAdapter`). Heute läuft alles über `MockTacAdapter`; sobald TAC freigegeben
ist, wird nur `RealTacAdapter` befüllt – sonst ändert sich nichts.

Mehr Details: siehe `ARCHITECTURE.md`.

## Projektstruktur

```
purespa-booking/
├── shared/types.ts              # Vertrag zwischen allen Teilen
├── backend/
│   └── src/
│       ├── server.ts            # Express-App, wählt Adapter per ENV
│       ├── cache.ts             # TTL-Cache (Echtzeit-Gefühl + Rate-Limit-Schutz)
│       ├── routes/booking.ts    # eigene API-Fassade vor TAC
│       └── adapters/
│           ├── TacAdapter.ts        # das Interface  ← die eine Naht zu TAC
│           ├── MockTacAdapter.ts    # aktiv: Dummy-Daten
│           └── RealTacAdapter.ts    # später befüllen
└── frontend/
    └── src/{App.tsx, api.ts, main.tsx}
```

## Lokal starten

```bash
# Terminal 1 – Backend (Mock-Modus, kein TAC-Zugang nötig)
cd backend && npm install && cp .env.example .env && npm run dev

# Terminal 2 – Frontend
cd frontend && npm install && npm run dev
```

Frontend öffnet auf http://localhost:5173, Backend auf http://localhost:3001.
Lege noch `frontend/public/hero.jpg` und `frontend/public/logo.svg` ab (Hero-Bild
+ Kolibri-Logo), dann sieht es aus wie dein Entwurf.

## Eigene API-Endpunkte (die TAC-Fassade)

| Methode | Pfad                | Zweck                                        |
|---------|---------------------|----------------------------------------------|
| GET     | `/api/locations`    | Standorte                                    |
| GET     | `/api/suites`       | Suiten je Standort                           |
| GET     | `/api/availability` | Tagesstatus für die Kalender-Einfärbung      |
| GET     | `/api/slots`        | Zeitslots eines Tages (nach Klick)           |
| POST    | `/api/bookings`     | Buchung anlegen (schreibt nach TAC)          |

Kalender-Status pro Tag: `available` (blau, klickbar) · `soldout` (ausgebucht) ·
`closed` (Vergangenheit/geschlossen).

---

## Start in Claude Code

1. Ordner in Claude Code öffnen:
   ```bash
   cd purespa-booking && claude
   ```

2. Als erste Nachricht an Claude Code (kopierbereit):

   > Lies README.md und ARCHITECTURE.md. Das ist ein Buchungstool für PureSpa,
   > das später per Adapter an die TAC-Spa-Software anbindet. Bring zuerst das
   > Mock-Setup lokal zum Laufen (Backend + Frontend), prüfe Frontend gegen
   > Backend, und schlage dann die nächsten Bausteine vor: (a) Slot-Buchung im
   > Frontend inkl. Gästedaten-Formular, (b) Login (rechts oben), (c) Tests für
   > den TacAdapter gegen das Interface. Ändere niemals shared/types ohne mich zu
   > fragen, und halte die ganze TAC-Logik in RealTacAdapter gekapselt.

3. Sobald die TAC-Schnittstellen-Doku da ist:

   > Hier ist die TAC-Interface-Spezifikation: <einfügen/anhängen>. Implementiere
   > ausschließlich RealTacAdapter.ts gegen das TacAdapter-Interface. Setze in
   > .env TAC_MODE=real mit BASE_URL und API_KEY. Routen, Cache, Frontend und
   > shared/types bleiben unverändert.

### Was du parallel (organisatorisch) klären musst

Der Mock läuft ohne TAC. Für echte Daten brauchst du von TAC – beantragt über
**PureSpa als Vertragskunde**:

- Gibt es ein **Realtime-Availability- und ein Booking-Interface** für externe Kanäle?
- Protokoll (REST/JSON, SOAP …) + genaue Endpunkte + Sandbox/Test
- Authentifizierung (API-Key-Header / OAuth2 / IP-Whitelist?)
- Feld-Mapping zu Standort, Suite, Personenzahl, Dauer, Slot
- **Rate-Limits** → bestimmen die Cache-TTL in `backend/src/cache.ts`
