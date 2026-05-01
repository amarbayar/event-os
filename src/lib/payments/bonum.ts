import { createHmac, timingSafeEqual } from "crypto";

type BonumToken = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  refreshExpiresIn?: number;
};

type CachedToken = BonumToken & {
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export type BonumCreateInvoiceInput = {
  amount: number;
  transactionId: string;
  callback: string;
  expiresIn: number;
  providers?: string[];
  items?: Array<{
    image?: string;
    title: string;
    remark?: string;
    amount: number;
    count: number;
  }>;
};

export type BonumCreateInvoiceResult = {
  invoiceId: string;
  followUpLink: string;
};

export type BonumInvoiceStatus = Record<string, unknown>;

export type BonumWebhookPayload = {
  type?: string;
  status?: string;
  message?: string;
  body?: {
    amount?: number;
    currency?: string;
    completedAt?: string;
    terminalId?: string;
    invoiceId?: string;
    paymentVendor?: string;
    initType?: string;
    status?: string;
    respCode?: string;
    transactionId?: string;
    invoiceStatus?: string;
    updatedAt?: string | number;
  };
};

let cachedToken: CachedToken | null = null;

function bonumConfig() {
  return {
    enabled: process.env.BONUM_ENABLED === "true",
    apiBaseUrl: (process.env.BONUM_API_BASE_URL || "https://testapi.bonum.mn").replace(
      /\/+$/,
      "",
    ),
    appSecret: process.env.BONUM_APP_SECRET,
    terminalId: process.env.BONUM_TERMINAL_ID,
    webhookChecksumKey: process.env.BONUM_WEBHOOK_CHECKSUM_KEY,
    skipWebhookChecksum:
      process.env.NODE_ENV !== "production" &&
      process.env.BONUM_SKIP_WEBHOOK_CHECKSUM === "true",
  };
}

export function isBonumEnabled(): boolean {
  const cfg = bonumConfig();
  return Boolean(cfg.enabled && cfg.appSecret && cfg.terminalId);
}

async function requestBonumToken(): Promise<CachedToken> {
  const cfg = bonumConfig();
  if (!cfg.appSecret || !cfg.terminalId) {
    throw new Error("Bonum credentials are not configured");
  }

  const res = await fetch(`${cfg.apiBaseUrl}/bonum-gateway/ecommerce/auth/create`, {
    method: "GET",
    headers: {
      Authorization: `AppSecret ${cfg.appSecret}`,
      "X-TERMINAL-ID": cfg.terminalId,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Bonum auth failed with status ${res.status}`);
  }

  const token = (await res.json()) as BonumToken;
  const now = Date.now();
  return {
    ...token,
    accessTokenExpiresAt: now + Math.max(token.expiresIn - 60, 1) * 1000,
    refreshTokenExpiresAt:
      now + Math.max((token.refreshExpiresIn || token.expiresIn) - 60, 1) * 1000,
  };
}

async function refreshBonumToken(token: CachedToken): Promise<CachedToken | null> {
  const cfg = bonumConfig();
  if (!token.refreshToken || Date.now() >= token.refreshTokenExpiresAt) return null;

  const res = await fetch(`${cfg.apiBaseUrl}/bonum-gateway/ecommerce/auth/refresh`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token.refreshToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const refreshed = (await res.json()) as BonumToken;
  const now = Date.now();
  return {
    ...refreshed,
    accessTokenExpiresAt: now + Math.max(refreshed.expiresIn - 60, 1) * 1000,
    refreshTokenExpiresAt:
      now +
      Math.max((refreshed.refreshExpiresIn || refreshed.expiresIn) - 60, 1) * 1000,
  };
}

async function getBonumAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.accessTokenExpiresAt) {
    return cachedToken.accessToken;
  }

  if (cachedToken) {
    const refreshed = await refreshBonumToken(cachedToken);
    if (refreshed) {
      cachedToken = refreshed;
      return refreshed.accessToken;
    }
  }

  cachedToken = await requestBonumToken();
  return cachedToken.accessToken;
}

export async function createBonumInvoice(
  input: BonumCreateInvoiceInput,
): Promise<BonumCreateInvoiceResult> {
  if (!isBonumEnabled()) {
    throw new Error("Bonum is not configured");
  }

  const cfg = bonumConfig();
  const token = await getBonumAccessToken();
  const res = await fetch(`${cfg.apiBaseUrl}/bonum-gateway/ecommerce/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Language": "mn",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      callback: input.callback,
      transactionId: input.transactionId,
      expiresIn: input.expiresIn,
      providers: input.providers,
      items: input.items,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bonum invoice failed with status ${res.status}: ${body}`);
  }

  const invoice = (await res.json()) as Partial<BonumCreateInvoiceResult>;
  if (!invoice.invoiceId || !invoice.followUpLink) {
    throw new Error("Bonum invoice response is missing invoiceId or followUpLink");
  }

  return {
    invoiceId: invoice.invoiceId,
    followUpLink: invoice.followUpLink,
  };
}

export async function getBonumInvoiceStatus(
  invoiceId: string,
): Promise<BonumInvoiceStatus> {
  if (!isBonumEnabled()) {
    throw new Error("Bonum is not configured");
  }

  const cfg = bonumConfig();
  const token = await getBonumAccessToken();
  const res = await fetch(
    `${cfg.apiBaseUrl}/bonum-gateway/ecommerce/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bonum invoice status failed with status ${res.status}: ${body}`);
  }

  return (await res.json()) as BonumInvoiceStatus;
}

export function verifyBonumWebhookChecksum(
  rawBody: string,
  checksumHeader: string | null,
): boolean {
  const cfg = bonumConfig();
  if (cfg.skipWebhookChecksum) return true;
  if (!cfg.webhookChecksumKey || !checksumHeader) return false;

  const expected = createHmac("sha256", cfg.webhookChecksumKey)
    .update(rawBody, "utf8")
    .digest("hex");

  if (expected.length !== checksumHeader.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(checksumHeader));
}

export function getBonumTerminalId(): string | undefined {
  return bonumConfig().terminalId;
}
