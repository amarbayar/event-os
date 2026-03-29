/**
 * BotManager — singleton that manages bot adapter lifecycles in-process.
 *
 * When the admin enables a messaging channel in Settings, the API route
 * calls botManager.start(). When they disable it, botManager.stop().
 * On app boot, init() reads all enabled channels from the DB and
 * starts their adapters automatically.
 *
 * This runs inside the Next.js process — no separate bot service needed.
 *
 * IMPORTANT: Adapters are loaded via dynamic import() to avoid pulling
 * discord.js native deps into the Next.js build for routes that don't
 * need them.
 */

import { createRelay, type Platform } from "./relay";

// ─── Types ───────────────────────────────────────────

interface RunningAdapter {
  platform: Platform;
  orgId: string;
  stop: () => void;
}

// ─── Manager ─────────────────────────────────────────

class BotManager {
  /** Key: "platform:orgId" → running adapter */
  private adapters = new Map<string, RunningAdapter>();
  private initialized = false;

  private key(platform: string, orgId: string): string {
    return `${platform}:${orgId}`;
  }

  /**
   * Auto-start all enabled channels from the DB.
   * Called lazily on first use. Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const { db } = await import("@/db");
      const { messagingChannels } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      const channels = await db.query.messagingChannels.findMany({
        where: eq(messagingChannels.enabled, true),
      });

      for (const ch of channels) {
        if (!ch.botToken || !ch.organizationId) continue;
        const platform = ch.platform as Platform;
        if (platform !== "discord" && platform !== "telegram") continue;

        try {
          await this.start(platform, ch.organizationId, ch.botToken);
        } catch (err) {
          console.error(`[bot-manager] Failed to auto-start ${platform} for org ${ch.organizationId}:`, err);
        }
      }

      if (this.adapters.size > 0) {
        console.log(`[bot-manager] Auto-started ${this.adapters.size} adapter(s)`);
      }
    } catch (err) {
      console.error("[bot-manager] Init failed:", err);
    }
  }

  /**
   * Start a bot adapter for a given platform + org.
   * If one is already running for this combo, stops it first.
   */
  async start(platform: Platform, orgId: string, botToken: string): Promise<void> {
    const k = this.key(platform, orgId);

    if (this.adapters.has(k)) {
      this.stop(platform, orgId);
    }

    const eventOsUrl = (process.env.NEXTAUTH_URL || process.env.EVENT_OS_URL || "http://localhost:3000").replace(/\/$/, "");
    const serviceToken = process.env.SERVICE_TOKEN;

    if (!serviceToken) {
      console.error(`[bot-manager] Cannot start ${platform}: SERVICE_TOKEN not set`);
      return;
    }

    const relay = createRelay({ eventOsUrl, serviceToken, orgId });

    // Dynamic imports — avoids pulling discord.js native deps into Next.js build
    if (platform === "discord") {
      const { DiscordAdapter } = await import("./discord");
      const adapter = new DiscordAdapter({ token: botToken, relay });
      await adapter.start();
      this.adapters.set(k, { platform, orgId, stop: () => adapter.stop() });
    } else if (platform === "telegram") {
      const { TelegramAdapter } = await import("./telegram");
      const adapter = new TelegramAdapter({ token: botToken, relay });
      await adapter.start();
      this.adapters.set(k, { platform, orgId, stop: () => adapter.stop() });
    }
  }

  /** Stop a running adapter. */
  stop(platform: Platform, orgId: string): void {
    const k = this.key(platform, orgId);
    const adapter = this.adapters.get(k);
    if (adapter) {
      adapter.stop();
      this.adapters.delete(k);
    }
  }

  /** Check if an adapter is running. */
  isRunning(platform: Platform, orgId: string): boolean {
    return this.adapters.has(this.key(platform, orgId));
  }

  /** Stop all running adapters. */
  stopAll(): void {
    for (const adapter of this.adapters.values()) {
      adapter.stop();
    }
    this.adapters.clear();
  }

  /** List running adapters (for status display). */
  status(): { platform: string; orgId: string }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      platform: a.platform,
      orgId: a.orgId,
    }));
  }
}

// ─── Singleton ───────────────────────────────────────

export const botManager = new BotManager();
