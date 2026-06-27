import type { BookingRequest, CheckoutResult, PaymentStatus } from '../../../shared/types';
import type { TacAdapter } from '../adapters/TacAdapter';
import type { PaymentAdapter } from './PaymentAdapter';

/**
 * TacPayAdapter – TAC|Pay-Hosted-Checkout (PAYMENT_MODE=tacpay).
 *
 * !!! NOCH NICHT AKTIV !!!
 * Erst befüllen, wenn PureSpa bei TAC die TAC|Pay-Freigabe für externe
 * Buchungskanäle erwirkt hat und die Schnittstellen-Spezifikation vorliegt.
 *
 * Wichtig: Kartendaten NIEMALS selbst entgegennehmen. Der Gast wird auf den
 * gehosteten TAC|Pay-Checkout weitergeleitet (checkoutUrl). So bleiben wir
 * vollständig außerhalb des PCI-Scopes.
 *
 * Zu klären mit TAC (office@tac.eu.com):
 *   - Checkout-Endpunkt, Authentifizierung, Signatur
 *   - Webhook-URL + Payload-Struktur
 *   - Rückgabe der TAC-Reservierungsnummer nach Zahlung
 */
export class TacPayAdapter implements PaymentAdapter {
  private notImplemented(method: string): never {
    throw new Error(
      `TacPayAdapter.${method} ist noch nicht implementiert. ` +
        'Erst nach Erhalt der TAC|Pay-Spezifikation befüllen.',
    );
  }

  async startCheckout(_booking: BookingRequest, _tac: TacAdapter): Promise<CheckoutResult> {
    return this.notImplemented('startCheckout');
  }

  async getStatus(_paymentId: string): Promise<PaymentStatus> {
    return this.notImplemented('getStatus');
  }

  async handleWebhook(_payload: unknown): Promise<PaymentStatus | null> {
    return this.notImplemented('handleWebhook');
  }
}
