/**
 * Sehr einfacher In-Memory-Cache mit TTL.
 *
 * Zweck: Echtzeit-Verfügbarkeit fühlt sich live an, ohne TAC bei jedem
 * Tastendruck zu befragen. So bleiben wir innerhalb der TAC-Rate-Limits.
 *
 * Für Produktion mit mehreren Instanzen später ggf. durch Redis ersetzen –
 * die Schnittstelle (get/set) bleibt gleich.
 */
type Entry<T> = { value: T; expiresAt: number };

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();

  constructor(private defaultTtlMs: number) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Holt aus dem Cache oder ruft den Loader und cached dessen Ergebnis. */
  async wrap<T>(key: string, loader: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }
}
