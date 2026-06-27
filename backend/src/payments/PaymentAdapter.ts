import type { BookingRequest, CheckoutResult, PaymentStatus } from '../../../shared/types';
import type { TacAdapter } from '../adapters/TacAdapter';

/**
 * PaymentAdapter – die EINZIGE Naht zur Bezahlung.
 *
 * Zwei Implementierungen:
 *   PayOnSiteAdapter  – aktiv (Pilot): Buchung direkt anlegen, Zahlung vor Ort.
 *   TacPayAdapter     – später: TAC|Pay-Hosted-Checkout, Redirect-URL, Webhook.
 *
 * Umschalten per PAYMENT_MODE=onsite|tacpay in backend/.env.
 * Kartendaten werden NIEMALS selbst entgegengenommen.
 */
export interface PaymentAdapter {
  /** Checkout starten. Bei onsite: direkt buchen. Bei tacpay: checkoutUrl zurückgeben. */
  startCheckout(booking: BookingRequest, tac: TacAdapter): Promise<CheckoutResult>;

  /** Zahlungsstatus abfragen. */
  getStatus(paymentId: string): Promise<PaymentStatus>;

  /** TAC|Pay-Webhook verarbeiten (nur tacpay, sonst null). */
  handleWebhook(payload: unknown): Promise<PaymentStatus | null>;
}
