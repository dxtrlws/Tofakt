import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env().LOG_LEVEL,
  redact: {
    paths: [
      "password",
      "passwordHash",
      "confirmPassword",
      "apiKey",
      "accessToken",
      "refreshToken",
      "authorization",
      "cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.access_token",
      "*.refresh_token",
      "*.access_token_enc",
      "*.refresh_token_enc",
      "*.api_key",
      "*.password",
      "*.client_secret",
      "*.device_code",
      "clientSecret",
      "deviceCode",
      "api_key",
    ],
    censor: "[redacted]",
  },
});
