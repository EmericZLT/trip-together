export {};

declare global {
  interface Env {
    DB: {
      prepare(sql: string): {
        bind(...params: unknown[]): {
          first<T>(column?: string): Promise<T | null>;
          all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
          run(): Promise<{ meta: { changes: number } }>;
        };
        first<T>(column?: string): Promise<T | null>;
        all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
        run(): Promise<{ meta: { changes: number } }>;
      };
      batch(
        statements: unknown[],
      ): Promise<unknown>;
    };
    FILES: {
      put(
        key: string,
        value: ArrayBuffer | Uint8Array,
        options?: { httpMetadata?: { contentType?: string } },
      ): Promise<void>;
      get(
        key: string,
        options?: { range?: { offset: number; length: number } },
      ): Promise<{ body: Uint8Array } | null>;
      head(key: string): Promise<{ size: number } | null>;
      delete(keys: string | string[]): Promise<void>;
    };
    ASSETS: { fetch(request: Request): Promise<Response> };
    SESSION_SIGNING_KEY: string;
    APP_ENV: string;
    EMAIL_FROM: string;
    EMAIL?: { send(message: unknown): Promise<void> };
    GEOAPIFY_API_KEY: string;
    ALLOWED_ORIGINS: string;
    SKIP_EMAIL_VERIFICATION: string;
    ANALYTICS_ENABLED: string;
    ANALYTICS_HOSTNAME: string;
    OPENPANEL_ORIGIN: string;
    OPENPANEL_CLIENT_ID: string;
    OPENPANEL_CLIENT_SECRET?: string;
    SEED_TOKEN: string;
  }
}
