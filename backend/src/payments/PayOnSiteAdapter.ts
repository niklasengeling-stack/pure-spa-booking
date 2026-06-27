import type { BookingRequest, CheckoutResult, PaymentStatus } from '../../../shared/types';
import type { TacAdapter } from '../adapters/TacAdapter';
import type { PaymentAdapter } from './PaymentAdapter';

/**
 * PayOnSiteAdapter – Pilot-Modus (PAYMENT_MODE=onsite).
 *
 * Legt die Buchung sofort in TAC an. Der Gast zahlt beim Besuch vor Ort.
 * Kein externer Zahlungsdienstleister, kein PCI-Scope.
 * Wird durch TacPayAdapter ersetzt, sobald TAC|Pay freigegeben ist.
 */
export class PayOnSiteAdapter implements PaymentAdapter {
  async startCheckout(booking: BookingRequest, tac: TacAdapter): Promise<CheckoutResult> {
    const result = await tac.createBooking(booking);
    const paymentId = 'ONSITE-' + Date.now();
    return {
      status: result.status === 'confirmed' ? 'confirmed' : 'failed',
      paymentId,
      bookingId: result.bookingId,
      message: result.message,
    };
  }

  async getStatus(paymentId: string): Promise<PaymentStatus> {
    return { paymentId, status: 'confirmed' };
  }

  async handleWebhook(_payload: unknown): Promise<PaymentStatus | null> {
    return null;
  }
}
