# Architektur & TAC-Anbindung

## Datenfluss

```
┌────────────┐    HTTPS/JSON   ┌──────────────────────┐   TacAdapter   ┌──────────┐
│  Frontend  │ ───────────────▶│  Backend-Fassade     │ ──────────────▶│   TAC    │
│  (React)   │◀─────────────── │  (Express + Cache)   │◀────────────── │ Res.Ass. │
└────────────┘    eigene API   └──────────────────────┘                └──────────┘
```

**Wichtig – Richtung des Datenflusses:** TAC ist die "Source of Truth".
Verfügbarkeiten werden aus TAC **gelesen**, Buchungen nach TAC **zurückgeschrieben**.
Wir stellen TAC keine API bereit, in die es sich integriert; wir **konsumieren**
TACs Schnittstelle und legen unsere eigene, saubere Fassade davor.

## Warum eine Backend-Fassade (und kein Direktzugriff vom Frontend)?

1. **Geheimhaltung:** TAC-Zugangsdaten gehören ins Backend, nie in den Browser.
2. **Rate-Limits:** TAC erlaubt nur begrenzt viele Abfragen. Der TTL-Cache
   bündelt Anfragen – der Kalender fühlt sich live an, ohne TAC zu überlasten.
3. **Entkopplung:** Ändert TAC sein Interface, ändert sich nur `RealTacAdapter`.
   Frontend, Routen und Typen bleiben stabil.
4. **Stabiler Vertrag:** Unsere API (`shared/types.ts`) ist unabhängig vom
   TAC-Datenmodell. Das schützt das Frontend vor TAC-Eigenheiten.

## Die eine Naht: TacAdapter

Alles TAC-Spezifische lebt in `backend/src/adapters/`:

- `TacAdapter.ts` – das Interface (der Vertrag).
- `MockTacAdapter.ts` – realistische Dummy-Daten, **heute aktiv**.
- `RealTacAdapter.ts` – echte Anbindung, **später befüllen**.

Umschalten per `TAC_MODE=mock|real` in `backend/.env`.

## Caching-Strategie

| Daten            | TTL      | Begründung                                  |
|------------------|----------|---------------------------------------------|
| Standorte/Suiten | 1 h      | ändern sich selten                          |
| Monatsverfügbar. | ~45 s    | "Echtzeit"-Gefühl, schont Rate-Limit        |
| Tages-Slots      | ~20 s    | kurz, da hier konkret gebucht wird          |

Echte Werte erst festlegen, wenn TACs Rate-Limits bekannt sind. Bei
Mehr-Instanz-Betrieb später `TtlCache` durch Redis ersetzen (gleiche Schnittstelle).

## Offene Punkte / Annahmen

- **TAC-Interface-Zugang ist organisatorisch zu klären** (über PureSpa). Ohne
  Freigabe gibt es keinen legitimen Echtzeit-Zugriff. Webshop-Scraping ist keine
  tragfähige Basis (fragil, rechtlich heikel, kein Rückschreiben von Buchungen).
- Buchungs-/Zahlungsfluss: Klären, ob Zahlung über TAC|Pay läuft oder separat.
- Login (rechts oben im Design): Gäste-Account – prüfen, ob TAC Kundendaten
  liefert oder ob ein eigener Account-Layer nötig ist.
