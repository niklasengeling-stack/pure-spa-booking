import type {
  Location,
  Suite,
  DayAvailability,
  DaySlots,
  BookingFilter,
  BookingRequest,
  BookingResult,
  Extra,
} from '../../shared/types';

// Im Dev läuft das Backend auf Port 3001 (siehe vite.config.ts Proxy).
const BASE = '/api';

function filterQuery(f: BookingFilter): string {
  const p = new URLSearchParams({
    location: f.locationId,
    guests: String(f.guests),
    duration: String(f.durationHours),
    suite: f.suiteId ?? 'all',
  });
  return p.toString();
}

export const api = {
  async getLocations(): Promise<Location[]> {
    return (await fetch(`${BASE}/locations`)).json();
  },

  async getSuites(locationId: string): Promise<Suite[]> {
    return (await fetch(`${BASE}/suites?location=${locationId}`)).json();
  },

  async getAvailability(f: BookingFilter, year: number, month: number): Promise<DayAvailability[]> {
    return (await fetch(`${BASE}/availability?${filterQuery(f)}&year=${year}&month=${month}`)).json();
  },

  async getSlots(f: BookingFilter, date: string): Promise<DaySlots> {
    return (await fetch(`${BASE}/slots?${filterQuery(f)}&date=${date}`)).json();
  },

  async getExtras(locationId: string): Promise<Extra[]> {
    return (await fetch(`${BASE}/extras?location=${locationId}`)).json();
  },

  async createBooking(req: BookingRequest): Promise<BookingResult> {
    return (
      await fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
    ).json();
  },
};
