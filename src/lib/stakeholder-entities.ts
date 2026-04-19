import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  booths,
  mediaPartners,
  speakerApplications,
  sponsorApplications,
  venues,
  volunteerApplications,
} from "@/db/schema";

type StakeholderEntityConfig = {
  table: unknown;
  idColumn: unknown;
  queryName: string;
  nameField: string;
  emailField: string;
  allowedFields: string[];
  versionColumn?: unknown;
};

const stakeholderEntityConfigs: Record<string, StakeholderEntityConfig> = {
  speaker: {
    table: speakerApplications,
    idColumn: speakerApplications.id,
    queryName: "speakerApplications",
    nameField: "name",
    emailField: "email",
    allowedFields: [
      "name",
      "bio",
      "headshotUrl",
      "talkTitle",
      "talkAbstract",
      "slideUrl",
      "phone",
      "linkedin",
      "website",
    ],
    versionColumn: speakerApplications.version,
  },
  sponsor: {
    table: sponsorApplications,
    idColumn: sponsorApplications.id,
    queryName: "sponsorApplications",
    nameField: "contactName",
    emailField: "contactEmail",
    allowedFields: ["contactName", "contactEmail", "logoUrl", "message"],
    versionColumn: sponsorApplications.version,
  },
  venue: {
    table: venues,
    idColumn: venues.id,
    queryName: "venues",
    nameField: "contactName",
    emailField: "contactEmail",
    allowedFields: ["contactName", "contactEmail", "mainImageUrl", "floorPlanUrl"],
  },
  booth: {
    table: booths,
    idColumn: booths.id,
    queryName: "booths",
    nameField: "companyName",
    emailField: "contactEmail",
    allowedFields: ["contactName", "contactEmail", "companyLogoUrl"],
  },
  volunteer: {
    table: volunteerApplications,
    idColumn: volunteerApplications.id,
    queryName: "volunteerApplications",
    nameField: "name",
    emailField: "email",
    allowedFields: ["name", "headshotUrl", "phone"],
    versionColumn: volunteerApplications.version,
  },
  media: {
    table: mediaPartners,
    idColumn: mediaPartners.id,
    queryName: "mediaPartners",
    nameField: "contactName",
    emailField: "contactEmail",
    allowedFields: ["contactName", "contactEmail", "logoUrl"],
  },
};

export function getStakeholderEntityConfig(entityType: string) {
  return stakeholderEntityConfigs[entityType];
}

export function getStakeholderAllowedFields(entityType: string): string[] {
  return getStakeholderEntityConfig(entityType)?.allowedFields || [];
}

export function sanitizeStakeholderUpdates(
  entityType: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const allowed = new Set(getStakeholderAllowedFields(entityType));
  const updates: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(payload)) {
    if (allowed.has(field) && value !== undefined) {
      updates[field] = value;
    }
  }

  return updates;
}

export function canSyncChecklistField(
  entityType: string,
  fieldKey: string | null | undefined
): fieldKey is string {
  return !!fieldKey && getStakeholderAllowedFields(entityType).includes(fieldKey);
}

export async function findStakeholderEntity(
  entityType: string,
  entityId: string
): Promise<Record<string, unknown> | undefined> {
  const config = getStakeholderEntityConfig(entityType);
  if (!config) return undefined;

  const queryFn = (db.query as Record<string, {
    findFirst?: (options: unknown) => Promise<Record<string, unknown> | undefined>;
  }>)[config.queryName];
  if (!queryFn?.findFirst) return undefined;

  return queryFn.findFirst({
    where: (table: Record<string, unknown>, { eq: eqFn }: { eq: typeof eq }) =>
      eqFn(table.id as Parameters<typeof eq>[0], entityId),
  }) as Promise<Record<string, unknown> | undefined>;
}

export async function updateStakeholderEntity(
  entityType: string,
  entityId: string,
  updates: Record<string, unknown>
) {
  const config = getStakeholderEntityConfig(entityType);
  if (!config || Object.keys(updates).length === 0) return null;

  const setPayload: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date(),
  };

  if (config.versionColumn) {
    setPayload.version = sql`${config.versionColumn} + 1`;
  }

  const [updated] = await db
    .update(config.table)
    .set(setPayload)
    .where(eq(config.idColumn as Parameters<typeof eq>[0], entityId))
    .returning();

  return updated || null;
}
