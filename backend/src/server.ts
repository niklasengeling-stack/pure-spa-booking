import express from 'express';
import cors from 'cors';
import { TtlCache } from './cache';
import { createBookingRouter } from './routes/booking';
import { createPaymentRouter } from './routes/payment';
import { MockTacAdapter } from './adapters/MockTacAdapter';
import { RealTacAdapter } from './adapters/RealTacAdapter';
import { PayOnSiteAdapter } from './payments/PayOnSiteAdapter';
import { TacPayAdapter } from './payments/TacPayAdapter';
import type { TacAdapter } from './adapters/TacAdapter';
import type { PaymentAdapter } from './payments/PaymentAdapter';

const PORT = Number(process.env.PORT ?? 3001);

function selectTacAdapter(): TacAdapter {
  if (process.env.TAC_MODE === 'real') {
    const baseUrl = process.env.TAC_BASE_URL ?? '';
    const apiKey = process.env.TAC_API_KEY ?? '';
    if (!baseUrl || !apiKey) {
      throw new Error('TAC_MODE=real benötigt TAC_BASE_URL und TAC_API_KEY in der .env.');
    }
    return new RealTacAdapter(baseUrl, apiKey);
  }
  return new MockTacAdapter();
}

function selectPaymentAdapter(): PaymentAdapter {
  if (process.env.PAYMENT_MODE === 'tacpay') return new TacPayAdapter();
  return new PayOnSiteAdapter();
}

const app = express();
app.use(cors());
app.use(express.json());

const cache = new TtlCache(30_000);
const tac = selectTacAdapter();
const payment = selectPaymentAdapter();

app.get('/health', (_req, res) => res.json({
  ok: true,
  tacMode: process.env.TAC_MODE ?? 'mock',
  paymentMode: process.env.PAYMENT_MODE ?? 'onsite',
}));

app.use('/api', createBookingRouter(tac, cache));
app.use('/api', createPaymentRouter(payment, tac));

// Zentrales Error-Handling: Fehler im Klartext, nie TAC-Interna nach außen leaken.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ status: 'failed', message: 'Verfügbarkeit konnte nicht geladen werden. Bitte erneut versuchen.' });
});

app.listen(PORT, () => {
  console.log(`PureSpa-Backend läuft auf http://localhost:${PORT} (TAC: ${process.env.TAC_MODE ?? 'mock'}, Payment: ${process.env.PAYMENT_MODE ?? 'onsite'})`);
});
