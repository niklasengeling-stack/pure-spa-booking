import { Router } from 'express';
import type { PaymentAdapter } from '../payments/PaymentAdapter';
import type { TacAdapter } from '../adapters/TacAdapter';
import type { BookingRequest } from '../../../shared/types';

/**
 * Payment-Fassade.
 *
 * POST /api/checkout          – Bezahlvorgang starten (onsite: direkt buchen)
 * GET  /api/checkout/:id      – Zahlungsstatus abfragen
 * POST /api/payment/webhook   – TAC|Pay-Ergebnis empfangen (nur tacpay)
 */
export function createPaymentRouter(payment: PaymentAdapter, tac: TacAdapter): Router {
  const router = Router();

  router.post('/checkout', async (req, res, next) => {
    try {
      const booking: BookingRequest = req.body.booking ?? req.body;
      const result = await payment.startCheckout(booking, tac);
      res.status(result.status === 'failed' ? 422 : 201).json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get('/checkout/:paymentId', async (req, res, next) => {
    try {
      const status = await payment.getStatus(req.params.paymentId);
      res.json(status);
    } catch (e) {
      next(e);
    }
  });

  router.post('/payment/webhook', async (req, res, next) => {
    try {
      const result = await payment.handleWebhook(req.body);
      res.json(result ?? { received: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
