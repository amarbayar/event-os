/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * Auto-starts bot adapters for messaging channels that were
 * previously enabled in Settings.
 */

export async function register() {
  // Only run in Node.js runtime (not Edge, not during build)
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Delay to let the server fully initialize
  setTimeout(async () => {
    try {
      const { botManager } = await import("@/lib/bots/manager");
      await botManager.init();
    } catch (err) {
      console.error("[instrumentation] Bot manager init failed:", err);
    }
  }, 3000);
}
