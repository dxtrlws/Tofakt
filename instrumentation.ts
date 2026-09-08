export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  ) {
    return;
  }
  const { encryptionKey } = await import("./lib/crypto");
  await import("./lib/boot");
  const { runMigrations } = await import("./lib/db/migrate");
  encryptionKey();
  runMigrations();
  const { seedConnectionsFromEnv } = await import("./lib/connections/service");
  seedConnectionsFromEnv();
  if (process.env.VITEST) {
    return;
  }
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
