import type {
  Location,
  Suite,
  BookingFilter,
  DayAvailability,
  DaySlots,
  Slot,
  BookingRequest,
  BookingResult,
  Extra,
} from '../../../shared/types';
import type { TacAdapter } from './TacAdapter';

/**
 * MockTacAdapter – realistische Dummy-Daten, die das Verhalten von TAC nachahmen.
 *
 * Damit ist das gesamte Tool sofort entwickel- und testbar, OHNE TAC-Zugang.
 * Die Zahlen orientieren sich am echten PureSpa-Webshop:
 *   2 Std ab 98 € · 3 Std ab 147 € · 4 Std ab 196 € · 5 Std ab 245 € · 6 Std ab 288 €
 */

const LOCATIONS: Location[] = [
  { id: 'dortmund', name: 'Dortmund' },
  { id: 'oberhausen', name: 'Oberhausen' },
];

/**
 * TAC-Katalog-IDs je Standort (aus den Live-Shops, für RealTacAdapter).
 * categoryId = Personen, templateId = Dauer.
 *
 * Dortmund:   2P→480  3P→481  4P→482 | 2h→489  3h→490  4h→491  5h→492  6h→493
 * Oberhausen: 2P→187  3P→188  4P→348 | 2h→189  3h→190  4h→191  5h→192  6h→193
 */
export const TAC_CATEGORY_IDS: Record<string, Record<number, number>> = {
  dortmund:   { 2: 480, 3: 481, 4: 482 },
  oberhausen: { 2: 187, 3: 188, 4: 348 },
};
export const TAC_TEMPLATE_IDS: Record<string, Record<number, number>> = {
  dortmund:   { 2: 489, 3: 490, 4: 491, 5: 492, 6: 493 },
  oberhausen: { 2: 189, 3: 190, 4: 191, 5: 192, 6: 193 },
};

const SUITES: Suite[] = [
  { id: 'marrakesch', name: 'Marrakesch Suite' },
  { id: 'bali', name: 'Bali Suite' },
  { id: 'finnland', name: 'Finnland Suite' },
  { id: 'orient', name: 'Orient Suite' },
];

// Preistabelle in Cent – NICHT linear (6 Std = 288 €, nicht 294 €). Quelle: CLAUDE.md.
const PRICE_CENTS: Record<number, number> = {
  2: 9800,   // 98 €
  3: 14700,  // 147 €
  4: 19600,  // 196 €
  5: 24500,  // 245 €
  6: 28800,  // 288 €
};

const EXTRAS: Extra[] = [
  { id: 'bademantel_person', name: 'Bademantel & Saunahandtuch pro Person', priceCents: 1500 },
  { id: 'birthday', name: 'Birthdaypacket', description: 'Dekoration & Ballons, 0,7 alkoholfreier Sekt, wahlweise Prosecco oder Wein', priceCents: 3900, maxQty: 1 },
  { id: 'romantik', name: 'Romantikpacket', description: 'Kerzen & Rosenblätter, 0,7 alkoholfreier Sekt, wahlw. Prosecco oder Wein', priceCents: 3900, maxQty: 1 },
];


/** Deterministischer Pseudo-Zufall, damit dieselbe Anfrage stabil dieselbe Belegung liefert. */
function seededStatus(date: string, filter: BookingFilter): DayAvailability['status'] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + 'T00:00:00');

  if (d < today) return 'closed';               // Vergangenheit
  const daysAhead = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (daysAhead > 90) return 'closed';          // Buchungsfenster: 90 Tage

  // Pseudo-Zufall aus Datum + Filter erzeugen.
  let hash = 0;
  const key = date + filter.locationId + filter.guests + filter.durationHours + (filter.suiteId ?? 'all');
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;

  // ~35 % ausgebucht, Rest verfügbar. Montag/Dienstag öfter zu.
  const weekday = d.getDay(); // 0 So … 6 Sa
  const soldoutChance = weekday === 1 || weekday === 2 ? 0.55 : 0.3;
  return (hash % 100) / 100 < soldoutChance ? 'soldout' : 'available';
}

export class MockTacAdapter implements TacAdapter {
  async getLocations(): Promise<Location[]> {
    return LOCATIONS;
  }

  async getSuites(_locationId: string): Promise<Suite[]> {
    return SUITES;
  }

  async getMonthAvailability(
    filter: BookingFilter,
    year: number,
    month: number,
  ): Promise<DayAvailability[]> {
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: DayAvailability[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const status = seededStatus(date, filter);
      result.push({
        date,
        status,
        fromPrice: status === 'available' ? PRICE_CENTS[filter.durationHours] ?? 0 : undefined,
      });
    }
    return result;
  }

  async getDaySlots(filter: BookingFilter, date: string): Promise<DaySlots> {
    const status = seededStatus(date, filter);
    if (status !== 'available') {
      return { date, locationId: filter.locationId, slots: [] };
    }

    // Startzeiten in 10-Minuten-Rastern, in Blöcken – wie im echten Shop (9:00, 9:10 …).
    const startTimes = ['09:00', '09:10', '09:20', '09:30', '11:20', '11:30', '11:40', '11:50', '12:00', '16:40', '16:50', '17:50'];
    const suitesToOffer = filter.suiteId ? SUITES.filter((s) => s.id === filter.suiteId) : SUITES;

    const slots: Slot[] = [];
    for (const start of startTimes) {
      // pro Startzeit eine Suite anbieten (rotierend), nicht jede Kombination – realistischer.
      const suite = suitesToOffer[slots.length % suitesToOffer.length];
      const [h, m] = start.split(':').map(Number);
      const endMinutes = h * 60 + m + filter.durationHours * 60;
      const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      slots.push({
        id: `${date}_${start}_${suite.id}`,
        startTime: start,
        endTime,
        suiteId: suite.id,
        suiteName: suite.name,
        priceCents: PRICE_CENTS[filter.durationHours] ?? 0,
        available: true,
      });
    }
    return { date, locationId: filter.locationId, slots };
  }

  async getExtras(_locationId: string): Promise<Extra[]> {
    return EXTRAS;
  }

  async createBooking(request: BookingRequest): Promise<BookingResult> {
    // Mock: bestätigt immer. Der echte Adapter schreibt nach TAC zurück.
    return {
      status: 'confirmed',
      bookingId: 'MOCK-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      message: `Buchung für ${request.customer.firstName} ${request.customer.lastName} angelegt (Mock).`,
    };
  }
}
