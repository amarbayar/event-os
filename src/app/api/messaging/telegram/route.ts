import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messagingChannels } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { botManager } from "@/lib/bots/manager";

// GET — get Telegram config + bot status
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "read");
  if (isRbacError(ctx)) return ctx;

  const channel = await db.query.messagingChannels.findFirst({
    where: and(
      eq(messagingChannels.organizationId, ctx.orgId),
      eq(messagingChannels.platform, "telegram")
    ),
  });

  if (!channel) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      id: channel.id,
      botUsername: channel.botUsername,
      groupChatId: channel.groupChatId,
      groupTitle: await refreshGroupTitle(channel),
      enabled: channel.enabled,
      connectedAt: channel.connectedAt,
      botRunning: botManager.isRunning("telegram", ctx.orgId),
    },
  });
}

// Refresh group title from Telegram API (non-blocking, uses cached on failure)
async function refreshGroupTitle(channel: { id: string; botToken: string | null; groupChatId: string | null; groupTitle: string | null }): Promise<string | null> {
  if (!channel.botToken || !channel.groupChatId) return channel.groupTitle;
  try {
    const res = await fetch(`https://api.telegram.org/bot${channel.botToken}/getChat?chat_id=${channel.groupChatId}`);
    const data = await res.json();
    if (data.ok && data.result?.title && data.result.title !== channel.groupTitle) {
      db.update(messagingChannels)
        .set({ groupTitle: data.result.title })
        .where(eq(messagingChannels.id, channel.id))
        .catch(() => {});
      return data.result.title;
    }
  } catch {}
  return channel.groupTitle;
}

// POST — validate, detect, connect, disconnect
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { botToken, action } = body as { botToken?: string; action?: string };

  // Step 1: Validate bot token
  if (action === "validate" && botToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await res.json();
      if (!data.ok) {
        return NextResponse.json({ error: "Invalid bot token. Check with @BotFather." }, { status: 400 });
      }

      await db
        .insert(messagingChannels)
        .values({
          organizationId: ctx.orgId,
          platform: "telegram",
          botToken,
          botUsername: data.result.username,
          enabled: false,
        })
        .onConflictDoUpdate({
          target: [messagingChannels.organizationId, messagingChannels.platform],
          set: { botToken, botUsername: data.result.username },
        });

      return NextResponse.json({
        data: { botUsername: data.result.username, botName: data.result.first_name },
      });
    } catch {
      return NextResponse.json({ error: "Failed to validate token." }, { status: 502 });
    }
  }

  // Step 2: Detect group chats via getUpdates
  if (action === "detect-group") {
    const channel = await db.query.messagingChannels.findFirst({
      where: and(
        eq(messagingChannels.organizationId, ctx.orgId),
        eq(messagingChannels.platform, "telegram")
      ),
    });
    if (!channel?.botToken) {
      return NextResponse.json({ error: "Set up bot token first." }, { status: 400 });
    }

    // Pause the Telegram adapter briefly so getUpdates doesn't conflict with polling
    const wasRunning = botManager.isRunning("telegram", ctx.orgId);
    if (wasRunning) {
      botManager.stop("telegram", ctx.orgId);
      await new Promise((r) => setTimeout(r, 1000));
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${channel.botToken}/getUpdates?limit=50`);
      const data = await res.json();

      const groups: { chatId: string; title: string }[] = [];
      const seen = new Set<string>();
      for (const update of data.result || []) {
        const chat = update.message?.chat || update.my_chat_member?.chat;
        if (chat && (chat.type === "group" || chat.type === "supergroup")) {
          const id = String(chat.id);
          if (!seen.has(id)) {
            seen.add(id);
            groups.push({ chatId: id, title: chat.title || "Unnamed group" });
          }
        }
      }

      // Resume adapter if it was running
      if (wasRunning) {
        await botManager.start("telegram", ctx.orgId, channel.botToken).catch(() => {});
      }

      return NextResponse.json({
        data: { groups },
        message: groups.length === 0
          ? "No groups found. Add the bot to a group, send a message, then try again."
          : undefined,
      });
    } catch {
      // Resume adapter on failure too
      if (wasRunning) {
        await botManager.start("telegram", ctx.orgId, channel.botToken).catch(() => {});
      }
      return NextResponse.json({ error: "Failed to contact Telegram." }, { status: 502 });
    }
  }

  // Step 3: Connect — save to DB + start bot adapter
  if (action === "connect" && body.groupChatId) {
    const channel = await db.query.messagingChannels.findFirst({
      where: and(
        eq(messagingChannels.organizationId, ctx.orgId),
        eq(messagingChannels.platform, "telegram")
      ),
    });

    await db
      .update(messagingChannels)
      .set({
        groupChatId: body.groupChatId,
        groupTitle: body.groupTitle || null,
        enabled: true,
        connectedAt: new Date(),
      })
      .where(and(
        eq(messagingChannels.organizationId, ctx.orgId),
        eq(messagingChannels.platform, "telegram")
      ));

    // Start the Telegram bot adapter in-process
    if (channel?.botToken) {
      try {
        await botManager.start("telegram", ctx.orgId, channel.botToken);
      } catch (err) {
        console.error("[telegram] Bot start failed:", err);
      }
    }

    return NextResponse.json({
      data: { connected: true, botRunning: botManager.isRunning("telegram", ctx.orgId) },
    });
  }

  // Step 4: Disconnect — stop bot adapter + update DB
  if (action === "disconnect") {
    botManager.stop("telegram", ctx.orgId);

    await db
      .update(messagingChannels)
      .set({ enabled: false, connectedAt: null })
      .where(and(
        eq(messagingChannels.organizationId, ctx.orgId),
        eq(messagingChannels.platform, "telegram")
      ));

    return NextResponse.json({ data: { connected: false } });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
