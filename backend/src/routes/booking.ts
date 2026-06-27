import { Router } from 'express';
import type { TacAdapter } from '../adapters/TacAdapter';
import { TtlCache } from '../cache';
import type { BookingFilter } from '../../../shared/types';

/**
 * Unsere EIGENE API-Fassade vor TAC.
 *
 * Das Frontend spricht nur mit diesen Endpunkten – nie mit TAC.
 * Verfügbarkeitsabfragen werden kurz gecacht (Echtzeit-Gefühl + Rate-Limit-Schutz).
 */
export function createBookingRouter(tac: TacAdapter, cache: TtlCache): Router {
  const router = Router();

  // Hilfsfunktion: Filter aus Query-Parametern lesen.
  function parseFilter(q: Record<string, unknown>): BookingFilter {
    return {
      locationId: String(q.location ?? 'dortmund'),
      guests: Number(q.guests ?? 2),
      durationHours: Number(q.duration ?? 3),
      suiteId: q.suite && q.suite !== 'all' ? String(q.suite) : null,
    };
  }

  // GET /api/locations
  router.get('/locations', async (_req, res, next) => {
    try {
      res.json(await cache.wrap('locations', () => tac.getLocations(), 3_600_000));
    } catch (e) {
      next(e);
    }
  });

  // GET /api/suites?location=dortmund
  router.get('/suites', async (req, res, next) => {
    try {
      const location = String(req.query.location ?? 'dortmund');
      res.json(await cache.wrap(`suites:${location}`, () => tac.getSuites(location), 3_600_000));
    } catch (e) {
      next(e);
    }
  });

  // GET /api/availability?location=&guests=&duration=&suite=&year=&month=
  // -> Tagesstatus für die Kalender-Einfärbung.
  router.get('/availability', async (req, res, next) => {
    try {
      const filter = parseFilter(req.query);
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      const key = `avail:${filter.locationId}:${filter.guests}:${filter.durationHours}:${filter.suiteId}:${year}-${month}`;
      // Kurze TTL = "Echtzeit". An TAC-Rate-Limit anpassen.
      const data = await cache.wrap(key, () => tac.getMonthAvailability(filter, year, month), 45_000);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  // GET /api/slots?...&date=YYYY-MM-DD
  // -> konkrete Zeitslots eines Tages (nach Klick im Kalender).
  router.get('/slots', async (req, res, next) => {
    try {
      const filter = parseFilter(req.query);
      const date = String(req.query.date);
      const key = `slots:${filter.locationId}:${filter.guests}:${filter.durationHours}:${filter.suiteId}:${date}`;
      const data = await cache.wrap(key, () => tac.getDaySlots(filter, date), 20_000);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  // GET /api/extras?location=dortmund
  router.get('/extras', async (req, res, next) => {
    try {
      const location = String(req.query.location ?? 'dortmund');
      res.json(await cache.wrap(`extras:${location}`, () => tac.getExtras(location), 3_600_000));
    } catch (e) {
      next(e);
    }
  });

  // POST /api/bookings  -> Buchung anlegen (schreibt nach TAC).
  router.post('/bookings', async (req, res, next) => {
    try {
      const result = await tac.createBooking(req.body);
      res.status(result.status === 'failed' ? 422 : 201).json(result);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
