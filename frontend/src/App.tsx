import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Location, Suite, DayAvailability, Slot, BookingFilter, Extra, BookingResult } from '../../shared/types';
import { api } from './api';

const WEEKDAYS = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function firstWeekdayIndex(year: number, month: number): number {
  return ((new Date(year, month - 1, 1).getDay() + 6) % 7);
}

function addMonths(baseYear: number, baseMonth: number, offset: number) {
  const total = (baseMonth - 1) + offset;
  return { year: baseYear + Math.floor(total / 12), month: (total % 12) + 1 };
}

type Step = 'idle' | 'slots' | 'extras' | 'form' | 'confirmed';

// ─── Custom Filter-Dropdown ────────────────────────────────────────────────────

interface DropdownOption { value: string; label: string }

function FilterDropdown({
  label, value, options, onChange, alignRight = false,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white/60">{label}</span>
        <span className="flex-1 text-sm font-semibold text-[#34d3b4] text-right">{selected?.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          className={`h-3 w-3 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute top-full mt-2 z-50 min-w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10
          bg-neutral-900/95 backdrop-blur-md ${alignRight ? 'right-0' : 'left-0'}`}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-5 py-3 text-left text-sm transition-colors hover:bg-white/10
                ${opt.value === value ? 'text-[#34d3b4] font-semibold' : 'text-white/75'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [filter, setFilter] = useState<BookingFilter>({
    locationId: 'dortmund',
    guests: 2,
    durationHours: 3,
    suiteId: null,
  });

  const now = new Date();
  const [baseYear, setBaseYear] = useState(now.getFullYear());
  const [baseMonth, setBaseMonth] = useState(now.getMonth() + 1);

  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [extraSelections, setExtraSelections] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>('idle');

  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  const visibleMonths = useMemo(
    () => [0, 1, 2].map((offset) => addMonths(baseYear, baseMonth, offset)),
    [baseYear, baseMonth],
  );

  useEffect(() => { api.getLocations().then(setLocations); }, []);

  useEffect(() => {
    api.getSuites(filter.locationId).then(setSuites);
    api.getExtras(filter.locationId).then(setExtras);
  }, [filter.locationId]);

  useEffect(() => {
    Promise.all(
      visibleMonths.map(({ year, month }) => api.getAvailability(filter, year, month)),
    ).then((results) => setAvailability(results.flat()));
    setSelectedDate(null);
    setStep('idle');
    setSelectedSlot(null);
    setSlots(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, baseYear, baseMonth]);

  const statusByDate = useMemo(() => {
    const map = new Map<string, DayAvailability['status']>();
    for (const d of availability) map.set(d.date, d.status);
    return map;
  }, [availability]);

  async function onShowResults() {
    if (!selectedDate) return;
    const res = await api.getSlots(filter, selectedDate);
    setSlots(res.slots);
    setSelectedSlot(null);
    setStep('slots');
    setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function onSelectSlot(slot: Slot) {
    setSelectedSlot(slot);
    setExtraSelections({});
    setStep('extras');
    setTimeout(() => document.getElementById('extras')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function onProceedToForm() {
    setStep('form');
    setTimeout(() => document.getElementById('guestform')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    const selectedExtras = Object.entries(extraSelections)
      .filter(([, qty]) => qty > 0)
      .map(([extraId, quantity]) => ({ extraId, quantity }));
    const result = await api.createBooking({
      slotId: selectedSlot.id,
      filter,
      customer,
      extras: selectedExtras.length > 0 ? selectedExtras : undefined,
    });
    setBookingResult(result);
    setStep('confirmed');
    setSubmitting(false);
    setTimeout(() => document.getElementById('confirmation')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function startOver() {
    setStep('idle');
    setSelectedSlot(null);
    setSelectedDate(null);
    setSlots(null);
    setBookingResult(null);
    setExtraSelections({});
    setCustomer({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function prevMonth() {
    const { year, month } = addMonths(baseYear, baseMonth, -1);
    setBaseYear(year); setBaseMonth(month);
  }
  function nextMonth() {
    const { year, month } = addMonths(baseYear, baseMonth, 1);
    setBaseYear(year); setBaseMonth(month);
  }

  const extrasTotalCents = extras.reduce((sum, e) => sum + (extraSelections[e.id] ?? 0) * e.priceCents, 0);
  const totalCents = (selectedSlot?.priceCents ?? 0) + extrasTotalCents;

  // Slots nach Suite gruppieren für die Anzeige.
  const slotsBySuite = useMemo(() => {
    if (!slots) return [];
    const groups: { suiteId: string; suiteName: string; slots: Slot[] }[] = [];
    for (const slot of slots) {
      const group = groups.find((g) => g.suiteId === slot.suiteId);
      if (group) group.slots.push(slot);
      else groups.push({ suiteId: slot.suiteId, suiteName: slot.suiteName, slots: [slot] });
    }
    return groups;
  }, [slots]);

  // ── Bestätigung ─────────────────────────────────────────────────────────────
  if (step === 'confirmed' && bookingResult) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-5 py-20">
        <div id="confirmation" className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#34d3b4]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-10 w-10 text-neutral-900">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold">Buchung bestätigt!</h1>
          <p className="mt-3 text-neutral-400">Buchungsnummer: <strong className="text-white">{bookingResult.bookingId}</strong></p>
          <div className="mt-6 rounded-xl bg-neutral-900 p-4 text-left text-sm text-neutral-300 space-y-1">
            <div className="flex justify-between"><span>Suite</span><span>{selectedSlot?.suiteName}</span></div>
            <div className="flex justify-between"><span>Zeit</span><span>{selectedSlot?.startTime}–{selectedSlot?.endTime} Uhr</span></div>
            <div className="flex justify-between">
              <span>Datum</span>
              <span>{selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE')}</span>
            </div>
            {extras.filter((e) => (extraSelections[e.id] ?? 0) > 0).map((e) => (
              <div key={e.id} className="flex justify-between">
                <span>{extraSelections[e.id]}× {e.name}</span>
                <span>{euro((extraSelections[e.id] ?? 0) * e.priceCents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-neutral-700 pt-3 mt-3 font-bold text-white">
              <span>Gesamt</span><span>{euro(totalCents)}</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-neutral-500">Eine Bestätigung wird an {customer.email} gesendet.</p>
          <button onClick={startOver} className="mt-8 rounded-full border border-white/40 px-8 py-3 text-sm font-semibold transition hover:bg-white hover:text-neutral-900">
            Neue Buchung
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* ── HERO – Vollbild ─────────────────────────────────────────────────── */}
      <header
        className="relative min-h-screen bg-cover bg-center flex flex-col"
        style={{ backgroundImage: 'linear-gradient(180deg, rgba(10,4,20,.55) 0%, rgba(10,4,20,.82) 100%), url(/hero.jpg)' }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6 pb-16 flex flex-col flex-1">
          {/* Nav */}
          <div className="flex items-center justify-between">
            <img src="/logo.svg" alt="PureSpa" className="h-14 w-auto"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
            <button className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/75 hover:text-white transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Login
            </button>
          </div>

          <h1 className="mt-10 text-center text-5xl font-bold leading-tight sm:text-7xl">
            Entspannung kommt in Suiten.
          </h1>

          {/* Filter-Dropdowns */}
          <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-3">
            <FilterDropdown
              label="Standort"
              value={filter.locationId}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              onChange={(v) => setFilter((f) => ({ ...f, locationId: v }))}
            />
            <FilterDropdown
              label="Gäste"
              value={String(filter.guests)}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: n === 1 ? '1 Person' : `${n} Personen` }))}
              onChange={(v) => setFilter((f) => ({ ...f, guests: Number(v) }))}
            />
            <FilterDropdown
              label="Dauer"
              value={String(filter.durationHours)}
              options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} Stunden` }))}
              onChange={(v) => setFilter((f) => ({ ...f, durationHours: Number(v) }))}
            />
            <FilterDropdown
              label="Suite"
              value={filter.suiteId ?? 'all'}
              options={[{ value: 'all', label: 'Alle' }, ...suites.map((s) => ({ value: s.id, label: s.name }))]}
              onChange={(v) => setFilter((f) => ({ ...f, suiteId: v === 'all' ? null : v }))}
              alignRight
            />
          </div>

          {/* 3-Monats-Kalender */}
          <div className="mx-auto mt-6 w-full max-w-5xl rounded-3xl bg-white/95 backdrop-blur p-4 sm:p-6 text-neutral-800 shadow-2xl">
            <div className="flex items-start gap-2">
              <button onClick={prevMonth} aria-label="Vorheriger Monat"
                className="mt-1 rounded-lg p-1.5 hover:bg-neutral-100 transition shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 min-w-0">
                {visibleMonths.map(({ year, month }, idx) => (
                  <div key={`${year}-${month}`} className={idx === 1 ? 'hidden sm:block' : idx === 2 ? 'hidden lg:block' : ''}>
                    <MonthGrid year={year} month={month} statusByDate={statusByDate} selectedDate={selectedDate} onSelect={setSelectedDate} />
                  </div>
                ))}
              </div>

              <button onClick={nextMonth} aria-label="Nächster Monat"
                className="mt-1 rounded-lg p-1.5 hover:bg-neutral-100 transition shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex justify-end gap-5 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#34d3b4]" /> Verfügbar</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-neutral-900" /> Auswahl</span>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={onShowResults}
              disabled={!selectedDate}
              className="rounded-full bg-[#34d3b4] px-12 py-4 text-lg font-semibold text-neutral-900 shadow-lg transition hover:bg-[#2bbfa3] disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed"
            >
              Ergebnisse anzeigen
            </button>
          </div>
        </div>
      </header>

      {/* ── ZEITSLOTS ───────────────────────────────────────────────────────── */}
      {step !== 'idle' && (
        <section id="results" className="bg-white px-4 sm:px-6 py-12 text-neutral-900">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">
                  {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <span className="mt-1 inline-block rounded-full border border-neutral-300 px-3 py-0.5 text-sm text-neutral-600">
                  {locations.find((l) => l.id === filter.locationId)?.name}
                </span>
              </div>
              {slots && slots[0] && <span className="text-2xl font-bold shrink-0">{euro(slots[0].priceCents)}</span>}
            </div>

            {slotsBySuite.length > 0 ? (
              <>
                <p className="mt-3 text-sm text-neutral-500">Wählen Sie einen Starttermin.</p>
                {slotsBySuite.map(({ suiteId, suiteName, slots: suiteSlots }) => (
                  <div key={suiteId} className="mt-6">
                    <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                      {suiteName}
                    </h3>
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: `repeat(${Math.min(suiteSlots.length, 4)}, minmax(0, 1fr))` }}
                    >
                      {suiteSlots.map((s) => {
                        const isChosen = selectedSlot?.id === s.id;
                        return (
                          <button key={s.id} onClick={() => onSelectSlot(s)}
                            className={`rounded-full px-4 py-3 font-semibold transition ${isChosen
                              ? 'bg-neutral-900 text-white'
                              : 'bg-[#34d3b4] text-neutral-900 hover:bg-[#2bbfa3]'}`}>
                            {s.startTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="mt-8 text-neutral-500">Für diesen Tag sind keine Zeiten verfügbar.</p>
            )}
          </div>
        </section>
      )}

      {/* ── EXTRAS ──────────────────────────────────────────────────────────── */}
      {step === 'extras' && (
        <section id="extras" className="bg-neutral-100 px-4 sm:px-6 py-12 text-neutral-900">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Zusatzprodukte</p>
            <h2 className="mt-1 text-2xl font-bold">
              Pure Spa {filter.durationHours} Stunden {filter.guests} {filter.guests === 1 ? 'Person' : 'Personen'}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Um Ihren Aufenthalt in vollen Zügen genießen zu können, empfehlen wir Ihnen folgende Produkte zusätzlich zu Ihrer Reservierung:
            </p>

            <div className="mt-6 space-y-3">
              {extras.map((extra) => {
                const qty = extraSelections[extra.id] ?? 0;
                const isToggle = extra.maxQty === 1;
                const isSelected = qty > 0;
                return (
                  <div key={extra.id} className="rounded-2xl bg-white p-5 shadow-sm">
                    <p className="font-bold text-neutral-900">{extra.name}</p>
                    {extra.description && (
                      <p className="mt-1 text-sm text-neutral-500">{extra.description}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-4">
                      {isToggle ? (
                        <button
                          type="button"
                          onClick={() => setExtraSelections((p) => ({ ...p, [extra.id]: isSelected ? 0 : 1 }))}
                          className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                            isSelected
                              ? 'bg-neutral-900 text-white'
                              : 'bg-[#34d3b4] text-neutral-900 hover:bg-[#2bbfa3]'
                          }`}
                        >
                          {isSelected ? 'ausgewählt' : 'auswählen'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setExtraSelections((p) => ({ ...p, [extra.id]: Math.max(0, (p[extra.id] ?? 0) - 1) }))}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34d3b4] text-lg font-bold text-neutral-900 hover:bg-[#2bbfa3] transition"
                          >−</button>
                          <span className="w-5 text-center font-semibold">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setExtraSelections((p) => ({ ...p, [extra.id]: (p[extra.id] ?? 0) + 1 }))}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34d3b4] text-lg font-bold text-neutral-900 hover:bg-[#2bbfa3] transition"
                          >+</button>
                        </div>
                      )}
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold">{euro(extra.priceCents)}</div>
                        <div className="text-xs text-neutral-400">inkl. gesetzl. MwSt.</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {extrasTotalCents > 0 && (
              <div className="mt-4 flex justify-end text-sm text-neutral-600">
                Extras gesamt: <strong className="ml-1">{euro(extrasTotalCents)}</strong>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => { setStep('slots'); setSelectedSlot(null); }} className="text-sm text-neutral-500 hover:text-neutral-900">
                ← Andere Zeit wählen
              </button>
              <button onClick={onProceedToForm} className="rounded-full bg-[#34d3b4] px-10 py-4 text-lg font-semibold text-neutral-900 shadow-lg transition hover:bg-[#2bbfa3]">
                Weiter zur Buchung
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── GÄSTEDATEN ──────────────────────────────────────────────────────── */}
      {step === 'form' && (
        <section id="guestform" className="bg-white px-4 sm:px-6 py-12 text-neutral-900">
          <div className="mx-auto max-w-2xl">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Vorname *</label>
                  <input required value={customer.firstName} onChange={(e) => setCustomer((c) => ({ ...c, firstName: e.target.value }))} className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d3b4]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">Nachname *</label>
                  <input required value={customer.lastName} onChange={(e) => setCustomer((c) => ({ ...c, lastName: e.target.value }))} className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d3b4]" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">E-Mail *</label>
                <input required type="email" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d3b4]" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Telefon</label>
                <input type="tel" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d3b4]" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Anmerkungen</label>
                <textarea rows={3} value={customer.notes} onChange={(e) => setCustomer((c) => ({ ...c, notes: e.target.value }))} className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#34d3b4]" />
              </div>

              <div className="rounded-xl bg-neutral-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span>{selectedSlot?.suiteName} · {selectedSlot?.startTime}–{selectedSlot?.endTime} Uhr</span>
                  <span className="font-bold">{euro(selectedSlot?.priceCents ?? 0)}</span>
                </div>
                {extras.filter((e) => (extraSelections[e.id] ?? 0) > 0).map((e) => (
                  <div key={e.id} className="mt-1 flex justify-between text-neutral-600">
                    <span>{extraSelections[e.id]}× {e.name}</span>
                    <span>{euro((extraSelections[e.id] ?? 0) * e.priceCents)}</span>
                  </div>
                ))}
                <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3 text-base font-bold">
                  <span>Gesamt</span><span>{euro(totalCents)}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setStep('extras')} className="text-sm text-neutral-500 hover:text-neutral-900">← Zurück</button>
                <button type="submit" disabled={submitting} className="flex-1 rounded-full bg-[#34d3b4] py-4 text-lg font-bold text-neutral-900 shadow-lg transition hover:bg-[#2bbfa3] disabled:opacity-50">
                  {submitting ? 'Wird gebucht…' : `Jetzt buchen · ${euro(totalCents)}`}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Monats-Grid ──────────────────────────────────────────────────────────────

function MonthGrid({ year, month, statusByDate, selectedDate, onSelect }: {
  year: number; month: number;
  statusByDate: Map<string, DayAvailability['status']>;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = firstWeekdayIndex(year, month);

  return (
    <div>
      <p className="mb-3 text-sm font-bold text-neutral-700">{MONTHS_SHORT[month - 1]} {year}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-semibold text-neutral-400 mb-1">
        {WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
        {Array.from({ length: lead }).map((_, i) => <div key={`lead-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const status = statusByDate.get(date) ?? 'closed';
          const isSelected = selectedDate === date;
          const clickable = status === 'available';

          let cls = 'mx-auto flex h-8 w-8 items-center justify-center rounded-full transition text-xs font-normal ';
          if (isSelected) cls += 'bg-neutral-900 text-white';
          else if (status === 'available') cls += 'bg-[#34d3b4] text-neutral-900 hover:bg-[#2bbfa3] cursor-pointer';
          else cls += 'text-neutral-400 cursor-default';

          return (
            <button key={date} disabled={!clickable} onClick={() => onSelect(date)} className={cls}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
