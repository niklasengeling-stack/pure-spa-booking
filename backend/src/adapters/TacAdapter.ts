import type {
  Location,
  Suite,
  BookingFilter,
  DayAvailability,
  DaySlots,
  BookingRequest,
  BookingResult,
  Extra,
} from '../../../shared/types';

/**
 * TacAdapter – die EINZIGE Naht zum TAC-System ("Reservation Assistant").
 *
 * Das gesamte Backend kennt nur dieses Interface, niemals TAC direkt.
 * Es gibt zwei Implementierungen:
 *   - MockTacAdapter:  realistische Dummy-Daten, sofort lauffähig ohne TAC-Zugang.
 *   - RealTacAdapter:  spricht das echte TAC-Interface an (erst nach Freigabe durch PureSpa/TAC).
 *
 * Wenn die echten TAC-Endpunkte vorliegen, wird AUSSCHLIESSLICH RealTacAdapter
 * befüllt. Routen, Cache, Frontend und Typen bleiben unverändert.
 */
export interface TacAdapter {
  /** Alle buchbaren Standorte. */
  getLocations(): Promise<Location[]>;

  /** Alle Suiten-Typen eines Standorts. */
  getSuites(locationId: string): Promise<Suite[]>;

  /**
   * Tagesweise Verfügbarkeit für einen Monat – speist die Kalender-Einfärbung.
   * @param year  z. B. 2026
   * @param month 1–12
   */
  getMonthAvailability(
    filter: BookingFilter,
    year: number,
    month: number,
  ): Promise<DayAvailability[]>;

  /** Konkrete Zeitslots für einen einzelnen Tag (nach Klick im Kalender). */
  getDaySlots(filter: BookingFilter, date: string): Promise<DaySlots>;

  /** Buchbare Zusatzprodukte eines Standorts. */
  getExtras(locationId: string): Promise<Extra[]>;

  /** Buchung anlegen – schreibt zurück nach TAC. */
  createBooking(request: BookingRequest): Promise<BookingResult>;
}
