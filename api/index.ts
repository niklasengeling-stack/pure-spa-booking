import express from 'express';
import cors from 'cors';
import { TtlCache } from '../backend/src/cache';
import { createBookingRouter } from '../backend/src/routes/booking';
import { MockTacAdapter } from '../backend/src/adapters/MockTacAdapter';
import { RealTacAdapter } from '../backend/src/adapters/RealTacAdapter';
import type { TacAdapter } from '../backend/src/adapters/TacAdapter';

function selectAdapter(): TacAdapter {
  if (process.env.TAC_MODE === 'real') {
    const baseUrl = process.env.TAC_BASE_URL ?? '';
    const apiKey = process.env.TAC_API_KEY ?? '';
    if (!baseUrl || !apiKey) throw new Error('TAC_MODE=real benötigt TAC_BASE_URL und TAC_API_KEY.');
    return new RealTacAdapter(baseUrl, apiKey);
  }
  return new MockTacAdapter();
}

const app = express();
app.use(cors());
app.use(express.json());

const cache = new TtlCache(30_000);
const tac = selectAdapter();

app.get('/health', (_req, res) => res.json({ ok: true, mode: process.env.TAC_MODE ?? 'mock' }));
app.use('/api', createBookingRouter(tac, cache));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ status: 'failed', message: 'Verfügbarkeit konnte nicht geladen werden.' });
});

export default app;
