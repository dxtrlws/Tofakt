import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(9477),
  TZ: z.string().default("UTC"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_PATH: z.string().default("./data/watchlog.db"),
  AUTH_DISABLED: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  APP_ENCRYPTION_KEY: z.string().optional(),
  BASE_URL: z.string().optional(),
  TOFA_URL: z.string().optional(),
  TOFA_API_KEY: z.string().optional(),
  TRAKT_CLIENT_ID: z.string().optional(),
  TRAKT_CLIENT_SECRET: z.string().optional(),
  TRAKT_API_URL: z.string().optional(),
  TMDB_API_KEY: z.string().optional(),
  TMDB_API_URL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

function cached(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export function env(): Env {
  return cached();
}

export function isAuthDisabled(): boolean {
  return env().AUTH_DISABLED;
}
