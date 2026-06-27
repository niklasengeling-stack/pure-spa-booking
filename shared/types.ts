/**
 * Geteilte Domänen-Typen für das PureSpa-Buchungstool.
 *
 * Diese Typen bilden den VERTRAG zwischen Frontend, Backend und dem
 * TAC-Adapter. Sie sind bewusst unabhängig vom konkreten TAC-Datenmodell
 * gehalten: Der Adapter übersetzt zwischen TAC und diesen Typen. Wenn TAC
 * sein Interface ändert, ändert sich nur der Adapter – nicht diese Datei.
 */

/** Ein Standort, z. B. Dortmund oder Oberhausen. */
export interface Location {
  id: string;
  name: string;
}

/** Ein Suiten-Typ (Wellness-Suite). "Alle" wird im Frontend als Filter-Default ergänzt. */
export interface Suite {
  id: string;
  name: string;
}

/** Die vom Gast wählbaren Filter. Bestimmt, welche Slots TAC zurückgibt. */
export interface BookingFilter {
  locationId: string;
  guests: number;      // Anzahl Personen, z. B. 2, 3, 4
  durationHours: number; // Dauer in Stunden, z. B. 2, 3, 4, 5, 6
  suiteId: string | null; // null = "Alle"
}

/** Verfügbarkeit eines einzelnen Tages – steuert die Kalender-Einfärbung. */
export interface DayAvailability {
  date: string;        // ISO-Datum "YYYY-MM-DD"
  status: 'available' | 'soldout' | 'closed';
  // available = mind. ein freier Slot (blau, klickbar)
  // soldout   = ausgebucht (nicht klickbar)
  // closed    = außerhalb des Buchungszeitraums / geschlossen
  fromPrice?: number;  // ab-Preis in EUR-Cent, optional für Anzeige
}

/** Ein konkreter, buchbarer Zeitslot an einem Tag. */
export interface Slot {
  id: string;          // opaker Slot-Identifier von TAC – nie selbst konstruieren
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  suiteId: string;
  suiteName: string;
  priceCents: number;
  available: boolean;
}

/** Antwort auf eine Tages-Slot-Abfrage. */
export interface DaySlots {
  date: string;
  locationId: string;
  slots: Slot[];
}

/** Ein buchbares Zusatzprodukt (z. B. Bademantel, Romantikpaket). */
export interface Extra {
  id: string;
  name: string;
  description?: string;  // optionaler Untertitel
  priceCents: number;
  maxQty?: number;       // 1 = Toggle-Button; undefined = Stepper ohne Limit
}

/** Vom Gast gewählte Menge eines Extras in einer Buchung. */
export interface ExtraSelection {
  extraId: string;
  quantity: number;
}

/** Buchungsanfrage, die ans Backend (und von dort nach TAC) geht. */
export interface BookingRequest {
  slotId: string;
  filter: BookingFilter;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  notes?: string;
  extras?: ExtraSelection[];
}

/** Ergebnis einer Buchung. */
export interface BookingResult {
  status: 'confirmed' | 'pending' | 'failed';
  bookingId?: string;   // TAC-Reservierungsnummer
  message?: string;     // Fehler-/Hinweistext im Klartext für den Gast
}
