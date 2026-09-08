import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { env } from "./env";
import { logger } from "./logger";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT = "watchlog-aes-gcm";

function dataDir(): string {
  return dirname(env().DATABASE_PATH);
}

function keyPath(): string {
  return join(dataDir(), ".key");
}

function materialToKey(material: string): Buffer {
  return scryptSync(material, SALT, KEY_BYTES);
}

export function encryptionKey(): Buffer {
  const fromEnv = env().APP_ENCRYPTION_KEY;
  if (fromEnv) {
    return materialToKey(fromEnv);
  }

  const path = keyPath();
  if (existsSync(path)) {
    return materialToKey(readFileSync(path, "utf8").trim());
  }

  mkdirSync(dataDir(), { recursive: true });
  const generated = randomBytes(KEY_BYTES).toString("hex");
  writeFileSync(path, generated, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  logger.warn(
    { path },
    "Generated APP_ENCRYPTION_KEY on disk. Losing this file means re-authenticating every connection.",
  );
  return materialToKey(generated);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Malformed ciphertext");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
