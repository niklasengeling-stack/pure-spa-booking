import express from 'express';
import cors from 'cors';
import { TtlCache } from './cache';
import { createBookingRouter } from './routes/booking';
import { MockTacAdapter } from './adapters/MockTacAdapter';
import { RealTacAdapter } from './adapters/RealTacAdapter';
import type { TacAdapter } from './adapters/TacAdapter';

const PORT = Number(process.env.PORT ?? 3001);

/**
 * Adapter-Auswahl über Umgebungsvariable.
 *   TAC_MODE=mock  -> MockTacAdapter (Standard, ohne TAC-Zugang)
 *   TAC_MODE=real  -> RealTacAdapter (erst nach TAC-Freigabe)
 */
function selectAdapter(): TacAdapter {
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

const app = express();
app.use(cors());
app.use(express.json());

const cache = new TtlCache(30_000);
const tac = selectAdapter();

app.get('/health', (_req, res) => res.json({ ok: true, mode: process.env.TAC_MODE ?? 'mock' }));
app.use('/api', createBookingRouter(tac, cache));

// Zentrales Error-Handling: Fehler im Klartext, nie TAC-Interna nach außen leaken.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ status: 'failed', message: 'Verfügbarkeit konnte nicht geladen werden. Bitte erneut versuchen.' });
});

app.listen(PORT, () => {
  console.log(`PureSpa-Backend läuft auf http://localhost:${PORT} (Modus: ${process.env.TAC_MODE ?? 'mock'})`);
});
