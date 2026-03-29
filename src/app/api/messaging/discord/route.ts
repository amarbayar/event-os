import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messagingChannels } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { botManager } from "@/lib/bots/manager";

// GET — get Discord config + bot status
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "read");
  if (isRbacError(ctx)) return ctx;

  const channel = await db.query.messagingChannels.findFirst({
    where: and(
      eq(messagingChannels.organizationId, ctx.orgId),
      eq(messagingChannels.platform, "discord")
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
      groupTitle: channel.groupTitle,
      enabled: channel.enabled,
      connectedAt: channel.connectedAt,
      botRunning: botManager.isRunning("discord", ctx.orgId),
    },
  });
}

// POST — validate, connect, disconnect
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { botToken, action } = body as { botToken?: string; action?: string };

  // Step 1: Validate bot token via Discord API
  if (action === "validate" && botToken) {
    try {
      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${botToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        return NextResponse.json({ error: "Invalid bot token. Check the Discord Developer Portal." }, { status: 400 });
      }

      await db
        .insert(messagingChannels)
        .values({
          organizationId: ctx.orgId,
          platform: "discord",
          botToken,
          botUsername: data.username,
          enabled: false,
        })
        .onConflictDoUpdate({
          target: [messagingChannels.organizationId, messagingChannels.platform],
          set: { botToken, botUsername: data.username },
        });

      return NextResponse.json({
        data: { username: data.username, id: data.id },
      });
    } catch {
      return NextResponse.json({ error: "Failed to validate token." }, { status: 502 });
    }
  }

  // Step 2: Connect — save to DB + start bot adapter
  if (action === "connect" && body.serverId) {
    const channel = await db.query.messagingChannels.findFirst({
      where: and(
        eq(messagingChannels.organizationId, ctx.orgId),
        eq(messagingChannels.platform, "discord")
      ),
    });

    if (!channel?.botToken) {
      return NextResponse.json({ error: "Set up bot token first." }, { status: 400 });
    }

    let serverName = "Discord server";
    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${body.serverId}`, {
        headers: { Authorization: `Bot ${channel.botToken}` },
      });
      const data = await res.json();
      if (data.name) serverName = data.name;
    } catch {}

    await db
      .update(messagingChannels)
      .set({
        groupChatId: body.serverId,
        groupTitle: serverName,
        enabled: true,
        connectedAt: new Date(),
      })
      .where(eq(messagingChannels.id, channel.id));

    // Start the Discord bot adapter in-process
    try {
      await botManager.start("discord", ctx.orgId, channel.botToken);
    } catch (err) {
      console.error("[discord] Bot start failed:", err);
    }

    return NextResponse.json({
      data: { connected: true, serverName, botRunning: botManager.isRunning("discord", ctx.orgId) },
    });
  }

  // Step 3: Disconnect — stop bot adapter + update DB
  if (action === "disconnect") {
    botManager.stop("discord", ctx.orgId);

    await db
      .update(messagingChannels)
      .set({ enabled: false, connectedAt: null })
      .where(and(
        eq(messagingChannels.organizationId, ctx.orgId),
        eq(messagingChannels.platform, "discord")
      ));

    return NextResponse.json({ data: { connected: false } });
  }

  // Step 4: Reset — remove bot entirely so user can re-enter token
  if (action === "reset") {
    botManager.stop("discord", ctx.orgId);

    await db
      .delete(messagingChannels)
      .where(and(
        eq(messagingChannels.organizationId, ctx.orgId),
        eq(messagingChannels.platform, "discord")
      ));

    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
