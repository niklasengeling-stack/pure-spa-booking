import express from 'express';
import cors from 'cors';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface Location { id: string; name: string; }
interface Suite { id: string; name: string; }
interface Extra { id: string; name: string; description?: string; priceCents: number; maxQty?: number; }
interface BookingFilter { locationId: string; guests: number; durationHours: number; suiteId: string | null; }
interface DayAvailability { date: string; status: 'available' | 'soldout' | 'closed'; fromPrice?: number; }
interface Slot { id: string; startTime: string; endTime: string; suiteId: string; suiteName: string; priceCents: number; available: boolean; }
interface DaySlots { date: string; locationId: string; slots: Slot[]; }
interface BookingRequest { slotId: string; filter: BookingFilter; customer: { firstName: string; lastName: string; email: string; phone?: string; }; notes?: string; extras?: { extraId: string; quantity: number }[]; }
interface BookingResult { status: 'confirmed' | 'pending' | 'failed'; bookingId?: string; message?: string; }

// ─── TTL-Cache ────────────────────────────────────────────────────────────────

class TtlCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  constructor(private defaultTtl: number) {}
  async wrap<T>(key: string, fn: () => Promise<T>, ttl = this.defaultTtl): Promise<T> {
    const cached = this.store.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const value = await fn();
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  }
}

// ─── Mock-Daten ───────────────────────────────────────────────────────────────

const LOCATIONS: Location[] = [
  { id: 'dortmund', name: 'Dortmund' },
  { id: 'oberhausen', name: 'Oberhausen' },
];

const SUITES: Suite[] = [
  { id: 'marrakesch', name: 'Marrakesch Suite' },
  { id: 'bali', name: 'Bali Suite' },
  { id: 'finnland', name: 'Finnland Suite' },
  { id: 'orient', name: 'Orient Suite' },
];

const EXTRAS: Extra[] = [
  { id: 'bademantel_person', name: 'Bademantel & Saunahandtuch pro Person', priceCents: 1500 },
  { id: 'birthday', name: 'Birthdaypacket', description: 'Dekoration & Ballons, 0,7 alkoholfreier Sekt, wahlweise Prosecco oder Wein', priceCents: 3900, maxQty: 1 },
  { id: 'romantik', name: 'Romantikpacket', description: 'Kerzen & Rosenblätter, 0,7 alkoholfreier Sekt, wahlw. Prosecco oder Wein', priceCents: 3900, maxQty: 1 },
];

// Preistabelle in Cent – nicht linear. Quelle: CLAUDE.md / TAC-Katalog Dortmund.
const PRICE_CENTS: Record<number, number> = {
  2: 9800, 3: 14700, 4: 19600, 5: 24500, 6: 28800,
};
function priceFor(filter: BookingFilter) { return PRICE_CENTS[filter.durationHours] ?? 0; }

function seededStatus(date: string, filter: BookingFilter): DayAvailability['status'] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date + 'T00:00:00');
  if (d < today) return 'closed';
  const daysAhead = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (daysAhead > 90) return 'closed';
  let hash = 0;
  const key = date + filter.locationId + filter.guests + filter.durationHours + (filter.suiteId ?? 'all');
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const weekday = d.getDay();
  const soldoutChance = weekday === 1 || weekday === 2 ? 0.55 : 0.3;
  return (hash % 100) / 100 < soldoutChance ? 'soldout' : 'available';
}

function getMonthAvailability(filter: BookingFilter, year: number, month: number): DayAvailability[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: DayAvailability[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = seededStatus(date, filter);
    result.push({ date, status, fromPrice: status === 'available' ? priceFor(filter) : undefined });
  }
  return result;
}

function getDaySlots(filter: BookingFilter, date: string): DaySlots {
  const status = seededStatus(date, filter);
  if (status !== 'available') return { date, locationId: filter.locationId, slots: [] };
  const startTimes = ['09:00', '09:10', '09:20', '09:30', '11:20', '11:30', '11:40', '11:50', '12:00', '16:40', '16:50', '17:50'];
  const suitesToOffer = filter.suiteId ? SUITES.filter(s => s.id === filter.suiteId) : SUITES;
  const slots: Slot[] = [];
  for (const start of startTimes) {
    const suite = suitesToOffer[slots.length % suitesToOffer.length];
    const [h, m] = start.split(':').map(Number);
    const endMinutes = h * 60 + m + filter.durationHours * 60;
    const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    slots.push({ id: `${date}_${start}_${suite.id}`, startTime: start, endTime, suiteId: suite.id, suiteName: suite.name, priceCents: priceFor(filter), available: true });
  }
  return { date, locationId: filter.locationId, slots };
}

// ─── Express-App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

const cache = new TtlCache(30_000);

function parseFilter(q: Record<string, unknown>): BookingFilter {
  return {
    locationId: String(q.location ?? 'dortmund'),
    guests: Number(q.guests ?? 2),
    durationHours: Number(q.duration ?? 3),
    suiteId: q.suite && q.suite !== 'all' ? String(q.suite) : null,
  };
}

app.get('/health', (_req, res) => res.json({ ok: true, mode: 'mock' }));

app.get('/api/locations', async (_req, res, next) => {
  try { res.json(await cache.wrap('locations', async () => LOCATIONS, 3_600_000)); } catch (e) { next(e); }
});

app.get('/api/suites', async (req, res, next) => {
  try {
    const loc = String(req.query.location ?? 'dortmund');
    res.json(await cache.wrap(`suites:${loc}`, async () => SUITES, 3_600_000));
  } catch (e) { next(e); }
});

app.get('/api/extras', async (req, res, next) => {
  try {
    const loc = String(req.query.location ?? 'dortmund');
    res.json(await cache.wrap(`extras:${loc}`, async () => EXTRAS, 3_600_000));
  } catch (e) { next(e); }
});

app.get('/api/availability', async (req, res, next) => {
  try {
    const filter = parseFilter(req.query);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const key = `avail:${filter.locationId}:${filter.guests}:${filter.durationHours}:${filter.suiteId}:${year}-${month}`;
    res.json(await cache.wrap(key, async () => getMonthAvailability(filter, year, month), 45_000));
  } catch (e) { next(e); }
});

app.get('/api/slots', async (req, res, next) => {
  try {
    const filter = parseFilter(req.query);
    const date = String(req.query.date);
    const key = `slots:${filter.locationId}:${filter.guests}:${filter.durationHours}:${filter.suiteId}:${date}`;
    res.json(await cache.wrap(key, async () => getDaySlots(filter, date), 20_000));
  } catch (e) { next(e); }
});

app.post('/api/bookings', async (req, res, next) => {
  try {
    const request: BookingRequest = req.body;
    const result: BookingResult = {
      status: 'confirmed',
      bookingId: 'MOCK-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      message: `Buchung für ${request.customer.firstName} ${request.customer.lastName} angelegt.`,
    };
    res.status(201).json(result);
  } catch (e) { next(e); }
});

// POST /api/checkout – Bezahlvorgang starten (onsite: direkt buchen)
app.post('/api/checkout', async (req, res, next) => {
  try {
    const booking: BookingRequest = req.body.booking ?? req.body;
    const bookingId = 'MOCK-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    res.status(201).json({
      status: 'confirmed',
      paymentId: 'ONSITE-' + Date.now(),
      bookingId,
      message: `Buchung für ${booking.customer.firstName} ${booking.customer.lastName} angelegt. Zahlung vor Ort.`,
    });
  } catch (e) { next(e); }
});

// GET /api/checkout/:paymentId – Zahlungsstatus
app.get('/api/checkout/:paymentId', (req, res) => {
  res.json({ paymentId: req.params.paymentId, status: 'confirmed' });
});

// POST /api/payment/webhook – TAC|Pay (Stub)
app.post('/api/payment/webhook', (_req, res) => {
  res.json({ received: true });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ status: 'failed', message: 'Verfügbarkeit konnte nicht geladen werden.' });
});

export default app;
