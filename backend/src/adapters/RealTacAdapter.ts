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
import type { TacAdapter } from './TacAdapter';

/**
 * RealTacAdapter – die echte Anbindung an TAC ("Reservation Assistant").
 *
 * !!! NOCH NICHT AKTIV !!!
 * Diese Klasse wird erst befüllt, wenn PureSpa bei TAC den Schnittstellen-Zugang
 * freigegeben hat und die Interface-Spezifikation vorliegt. Bis dahin läuft alles
 * über den MockTacAdapter.
 *
 * Sobald die TAC-Doku da ist, hier konkret klären/eintragen:
 *   - BASIS-URL des TAC-Interfaces
 *   - Protokoll (REST/JSON, SOAP, …) und genaue Endpunkte
 *   - Authentifizierung (API-Key-Header? OAuth2? IP-Whitelist?)
 *   - Mapping: TAC-Felder  <->  unsere shared/types
 *   - Rate-Limits (bestimmt die Cache-TTL in cache.ts)
 *
 * Wichtig: NUR diese Datei muss geändert werden. Routen, Cache, Frontend
 * und Typen bleiben unangetastet.
 */
export class RealTacAdapter implements TacAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private notImplemented(method: string): never {
    throw new Error(
      `RealTacAdapter.${method} ist noch nicht implementiert. ` +
        `Erst nach Erhalt der TAC-Interface-Spezifikation befüllen.`,
    );
  }

  async getLocations(): Promise<Location[]> {
    // Beispiel-Skizze – an echte TAC-Endpunkte anpassen:
    // const res = await fetch(`${this.baseUrl}/locations`, {
    //   headers: { Authorization: `Bearer ${this.apiKey}` },
    // });
    // const data = await res.json();
    // return data.map(mapTacLocation);
    return this.notImplemented('getLocations');
  }

  async getSuites(_locationId: string): Promise<Suite[]> {
    return this.notImplemented('getSuites');
  }

  async getMonthAvailability(
    _filter: BookingFilter,
    _year: number,
    _month: number,
  ): Promise<DayAvailability[]> {
    return this.notImplemented('getMonthAvailability');
  }

  async getDaySlots(_filter: BookingFilter, _date: string): Promise<DaySlots> {
    return this.notImplemented('getDaySlots');
  }

  async getExtras(_locationId: string): Promise<Extra[]> {
    return this.notImplemented('getExtras');
  }

  async createBooking(_request: BookingRequest): Promise<BookingResult> {
    return this.notImplemented('createBooking');
  }
}
