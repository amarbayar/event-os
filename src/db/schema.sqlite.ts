import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Helper defaults ────────────────────────────────────

const uuidPk = () =>
  text("id")
    .$defaultFn(() => randomUUID())
    .primaryKey();
const uuidCol = (name: string) => text(name);
const ts = (name: string) => integer(name, { mode: "timestamp" });
const tsNow = (name: string) =>
  integer(name, { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull();
const bool = (name: string) => integer(name, { mode: "boolean" });
const json = (name: string) => text(name, { mode: "json" });

// ─── Organizations ───────────────────────────────────────

export const organizations = sqliteTable("organizations", {
  id: uuidPk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  contactEmail: text("contact_email"),
  website: text("website"),
  brandColor: text("brand_color"),
  logoUrl: text("logo_url"),
  botLanguage: text("bot_language").default("auto"),
  botMood: text("bot_mood").default("professional"),
  llmProvider: text("llm_provider"),
  llmModel: text("llm_model"),
  llmApiKey: text("llm_api_key"),
  createdAt: tsNow("created_at"),
  updatedAt: tsNow("updated_at"),
});

// ─── Event Series ────────────────────────────────────────

export const eventSeries = sqliteTable("event_series", {
  id: uuidPk(),
  organizationId: uuidCol("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: tsNow("created_at"),
});

// ─── Event Editions ──────────────────────────────────────

export const eventEditions = sqliteTable(
  "event_editions",
  {
    id: uuidPk(),
    seriesId: uuidCol("series_id")
      .notNull()
      .references(() => eventSeries.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    startDate: ts("start_date"),
    endDate: ts("end_date"),
    venue: text("venue"),
    status: text("status").default("draft").notNull(),
    agendaStatus: text("agenda_status").default("draft").notNull(),
    cfpOpen: bool("cfp_open").default(false).notNull(),
    timezone: text("timezone").default("Asia/Ulaanbaatar"),
    agendaGapMinutes: integer("agenda_gap_minutes").default(5).notNull(),
    agendaStartTime: text("agenda_start_time").default("09:00"),
    agendaEndTime: text("agenda_end_time").default("18:00"),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("edition_org_idx").on(table.organizationId),
    index("edition_slug_idx").on(table.slug),
  ],
);

// ─── Tracks ──────────────────────────────────────────────

export const tracks = sqliteTable("tracks", {
  id: uuidPk(),
  editionId: uuidCol("edition_id")
    .notNull()
    .references(() => eventEditions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").default(0).notNull(),
});

// ─── Speaker Applications ────────────────────────────────

export const speakerApplications = sqliteTable(
  "speaker_applications",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuidCol("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    company: text("company"),
    title: text("title"),
    linkedin: text("linkedin"),
    website: text("website"),
    talkTitle: text("talk_title").notNull(),
    talkAbstract: text("talk_abstract"),
    talkType: text("talk_type").default("talk").notNull(),
    trackPreference: text("track_preference"),
    slideUrl: text("slide_url"),
    requirements: json("requirements").$type<string[]>(),
    requirementsNotes: text("requirements_notes"),
    status: text("status").default("pending").notNull(),
    reviewScore: integer("review_score"),
    reviewNotes: text("review_notes"),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("speaker_edition_status_idx").on(table.editionId, table.status),
    index("speaker_edition_stage_idx").on(table.editionId, table.stage),
    index("speaker_org_idx").on(table.organizationId),
  ],
);

// ─── Sessions ────────────────────────────────────────────

export const sessions = sqliteTable(
  "sessions",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    trackId: uuidCol("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    speakerId: uuidCol("speaker_id").references(() => speakerApplications.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").default("talk").notNull(),
    startTime: ts("start_time"),
    endTime: ts("end_time"),
    room: text("room"),
    day: integer("day").default(1).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    hostId: uuidCol("host_id").references(() => users.id, {
      onDelete: "set null",
    }),
    panelSpeakerIds: json("panel_speaker_ids").$type<string[]>(),
    durationMinutes: integer("duration_minutes").default(30).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("session_edition_time_idx").on(table.editionId, table.startTime),
    index("session_edition_speaker_idx").on(table.editionId, table.speakerId),
  ],
);

// ─── Sponsor Applications ────────────────────────────────

export const sponsorApplications = sqliteTable(
  "sponsor_applications",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuidCol("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    logoUrl: text("logo_url"),
    packagePreference: text("package_preference"),
    message: text("message"),
    status: text("status").default("pending").notNull(),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [index("sponsor_org_idx").on(table.organizationId)],
);

// ─── Attendees ───────────────────────────────────────────

export const attendees = sqliteTable(
  "attendees",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuidCol("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    ticketType: text("ticket_type").default("general").notNull(),
    qrHash: text("qr_hash").notNull(),
    checkedIn: bool("checked_in").default(false).notNull(),
    checkedInAt: ts("checked_in_at"),
    checkedInBy: text("checked_in_by"),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    index("attendee_edition_qr_idx").on(table.editionId, table.qrHash),
    index("attendee_org_idx").on(table.organizationId),
  ],
);

// ─── Event Queue ─────────────────────────────────────────

export const eventQueue = sqliteTable(
  "event_queue",
  {
    id: uuidPk(),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: json("payload").notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    processedAt: ts("processed_at"),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    index("queue_status_created_idx").on(table.status, table.createdAt),
  ],
);

// ─── Venues ──────────────────────────────────────────────

export const venues = sqliteTable(
  "venues",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    capacity: integer("capacity"),
    priceQuote: text("price_quote"),
    status: text("status").default("identified").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    pros: text("pros"),
    cons: text("cons"),
    mainImageUrl: text("main_image_url"),
    interiorPhotos: json("interior_photos").$type<string[]>(),
    exteriorPhotos: json("exterior_photos").$type<string[]>(),
    floorPlanUrl: text("floor_plan_url"),
    notes: text("notes"),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("venue_edition_idx").on(table.editionId),
    index("venue_org_idx").on(table.organizationId),
  ],
);

// ─── Outreach (proactive sourcing for any entity) ────────

export const outreach = sqliteTable(
  "outreach",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuidCol("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    targetType: text("target_type").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    company: text("company"),
    role: text("role"),
    status: text("status").default("identified").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastContactDate: ts("last_contact_date"),
    nextFollowUp: ts("next_follow_up"),
    source: text("source"),
    notes: text("notes"),
    convertedToId: uuidCol("converted_to_id"),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("outreach_edition_type_idx").on(table.editionId, table.targetType),
    index("outreach_org_idx").on(table.organizationId),
    index("outreach_followup_idx").on(table.nextFollowUp),
  ],
);

// ─── Teams ───────────────────────────────────────────────

export const teams = sqliteTable("teams", {
  id: uuidPk(),
  editionId: uuidCol("edition_id").references(() => eventEditions.id, {
    onDelete: "cascade",
  }),
  organizationId: uuidCol("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: tsNow("created_at"),
});

// ─── Team → Entity Type Mapping (RBAC) ──────────────────

export const teamEntityTypes = sqliteTable(
  "team_entity_types",
  {
    id: uuidPk(),
    teamId: uuidCol("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
  },
  (table) => [
    uniqueIndex("team_entity_type_uniq").on(table.teamId, table.entityType),
  ],
);

export const teamMembers = sqliteTable("team_members", {
  id: uuidPk(),
  teamId: uuidCol("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: uuidCol("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  createdAt: tsNow("created_at"),
});

// ─── Tasks ───────────────────────────────────────────────

export const tasks = sqliteTable(
  "tasks",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: uuidCol("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").default("todo").notNull(),
    priority: text("priority").default("medium").notNull(),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assigneeName: text("assignee_name"),
    dueDate: ts("due_date"),
    linkedEntityType: text("linked_entity_type"),
    linkedEntityId: uuidCol("linked_entity_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
    source: text("source").default("intake").notNull(),
    assignedTo: text("assigned_to"),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("task_edition_team_idx").on(table.editionId, table.teamId),
    index("task_assignee_idx").on(table.assigneeId),
    index("task_due_idx").on(table.dueDate),
    index("task_org_idx").on(table.organizationId),
  ],
);

// ─── Invitations / Guest Allocations ─────────────────────

export const invitations = sqliteTable(
  "invitations",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    type: text("type").notNull(),
    invitedBy: text("invited_by"),
    sourceType: text("source_type"),
    sourceId: uuidCol("source_id"),
    status: text("status").default("pending").notNull(),
    qrHash: text("qr_hash"),
    checkedIn: bool("checked_in").default(false).notNull(),
    checkedInAt: ts("checked_in_at"),
    notes: text("notes"),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    index("invitation_edition_idx").on(table.editionId),
    index("invitation_org_idx").on(table.organizationId),
    index("invitation_source_idx").on(table.sourceType, table.sourceId),
    index("invitation_qr_idx").on(table.editionId, table.qrHash),
  ],
);

// ─── Volunteer Applications ──────────────────────────────

export const volunteerApplications = sqliteTable(
  "volunteer_applications",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuidCol("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    headshotUrl: text("headshot_url"),
    role: text("role"),
    availability: text("availability"),
    experience: text("experience"),
    tshirtSize: text("tshirt_size"),
    status: text("status").default("pending").notNull(),
    assignedShift: text("assigned_shift"),
    notes: text("notes"),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("volunteer_edition_idx").on(table.editionId),
    index("volunteer_org_idx").on(table.organizationId),
  ],
);

// ─── Booths ──────────────────────────────────────────────

export const booths = sqliteTable(
  "booths",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    companyName: text("company_name"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    companyLogoUrl: text("company_logo_url"),
    location: text("location"),
    size: text("size"),
    price: integer("price"),
    status: text("status").default("available").notNull(),
    sponsorId: uuidCol("sponsor_id").references(() => sponsorApplications.id, {
      onDelete: "set null",
    }),
    equipment: text("equipment"),
    notes: text("notes"),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("booth_edition_idx").on(table.editionId),
    index("booth_org_idx").on(table.organizationId),
  ],
);

// ─── Media Partners ──────────────────────────────────────

export const mediaPartners = sqliteTable(
  "media_partners",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    type: text("type"),
    reach: text("reach"),
    proposal: text("proposal"),
    deliverables: text("deliverables"),
    status: text("status").default("pending").notNull(),
    logoUrl: text("logo_url"),
    notes: text("notes"),
    source: text("source").default("intake").notNull(),
    stage: text("stage").default("lead").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("media_edition_idx").on(table.editionId),
    index("media_org_idx").on(table.organizationId),
  ],
);

// ─── Marketing Campaigns ─────────────────────────────────

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    platform: text("platform"),
    content: text("content"),
    scheduledDate: ts("scheduled_date"),
    publishedDate: ts("published_date"),
    status: text("status").default("draft").notNull(),
    speakerId: uuidCol("speaker_id").references(() => speakerApplications.id, {
      onDelete: "set null",
    }),
    sponsorId: uuidCol("sponsor_id").references(() => sponsorApplications.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    source: text("source").default("intake").notNull(),
    assignedTo: text("assigned_to"),
    assigneeId: uuidCol("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("campaign_edition_idx").on(table.editionId),
    index("campaign_org_idx").on(table.organizationId),
    index("campaign_scheduled_idx").on(table.scheduledDate),
  ],
);

// ─── Entity Notes / Discussion Thread ────────────────────

export const entityNotes = sqliteTable(
  "entity_notes",
  {
    id: uuidPk(),
    entityType: text("entity_type").notNull(),
    entityId: uuidCol("entity_id").notNull(),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email"),
    content: text("content").notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("note_entity_idx").on(table.entityType, table.entityId),
    index("note_org_idx").on(table.organizationId),
  ],
);

// ─── Checklist Templates ─────────────────────────────────

export const checklistTemplates = sqliteTable(
  "checklist_templates",
  {
    id: uuidPk(),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    fieldKey: text("field_key"),
    itemType: text("item_type").notNull(),
    required: bool("required").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    dueOffsetDays: integer("due_offset_days"),
    reminderTemplate: text("reminder_template"),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("checklist_tpl_edition_idx").on(table.editionId, table.entityType),
  ],
);

// ─── Checklist Items ─────────────────────────────────────

export const checklistItems = sqliteTable(
  "checklist_items",
  {
    id: uuidPk(),
    templateId: uuidCol("template_id")
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: "cascade" }),
    editionId: uuidCol("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuidCol("entity_id").notNull(),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: text("status").default("pending").notNull(),
    value: text("value"),
    submittedAt: ts("submitted_at"),
    approvedBy: uuidCol("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: ts("approved_at"),
    notes: text("notes"),
    reminderSentAt: ts("reminder_sent_at"),
    version: integer("version").default(1).notNull(),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [
    index("checklist_item_entity_idx").on(table.entityType, table.entityId),
    index("checklist_item_edition_idx").on(
      table.editionId,
      table.organizationId,
    ),
  ],
);

// ─── Notifications ───────────────────────────────────────

export const notifications = sqliteTable(
  "notifications",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    editionId: uuidCol("edition_id").references(() => eventEditions.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    link: text("link"),
    entityType: text("entity_type"),
    entityId: uuidCol("entity_id"),
    actorName: text("actor_name"),
    read: bool("read").default(false).notNull(),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    index("notification_user_idx").on(table.userId, table.read),
    index("notification_created_idx").on(table.createdAt),
  ],
);

// ─── Audit Log ───────────────────────────────────────────

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: uuidPk(),
    organizationId: uuidCol("organization_id").references(
      () => organizations.id,
    ),
    entityType: text("entity_type").notNull(),
    entityId: uuidCol("entity_id").notNull(),
    action: text("action").notNull(),
    changes: json("changes"),
    actorId: text("actor_id"),
    source: text("source").default("web").notNull(),
    createdAt: tsNow("created_at"),
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)],
);

// ─── Email Log ──────────────────────────────────────────

export const emailLog = sqliteTable(
  "email_log",
  {
    id: uuidPk(),
    organizationId: uuidCol("organization_id").references(
      () => organizations.id,
    ),
    driver: text("driver").notNull(), // mailgun, postmark, log
    fromEmail: text("from_email").notNull(),
    toEmails: json("to_emails").notNull(), // JSON array of email strings
    subject: text("subject").notNull(),
    status: text("status").notNull(), // sent, failed, skipped
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    entityType: text("entity_type"),
    entityId: uuidCol("entity_id"),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    index("email_log_org_idx").on(table.organizationId),
    index("email_log_entity_idx").on(table.entityType, table.entityId),
    index("email_log_created_idx").on(table.createdAt),
    index("email_log_dedup_idx").on(
      table.entityId,
      table.subject,
      table.createdAt,
    ),
  ],
);

// ─── Contacts (cross-org person identity) ────────────────

export const contacts = sqliteTable(
  "contacts",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    company: text("company"),
    title: text("title"),
    linkedin: text("linkedin"),
    website: text("website"),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (table) => [index("contact_email_idx").on(table.email)],
);

// ─── Users (for NextAuth) ────────────────────────────────

export const users = sqliteTable("users", {
  id: uuidPk(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: ts("email_verified"),
  image: text("image"),
  passwordHash: text("password_hash"),
  phone: text("phone"),
  forcePasswordChange: bool("force_password_change").default(false).notNull(),
  contactId: uuidCol("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  preferredLocale: text("preferred_locale").default("en"),
  createdAt: tsNow("created_at"),
});

// ─── User ↔ Organization Membership ─────────────────────

export const userOrganizations = sqliteTable(
  "user_organizations",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").default("organizer").notNull(),
    linkedEntityType: text("linked_entity_type"),
    linkedEntityId: uuidCol("linked_entity_id"),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    uniqueIndex("user_org_uniq").on(table.userId, table.organizationId),
    index("user_org_user_idx").on(table.userId),
    index("user_org_org_idx").on(table.organizationId),
  ],
);

// ─── User ↔ Platform Links (bot identity mapping) ──

export const userPlatformLinks = sqliteTable(
  "user_platform_links",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformUserId: text("platform_user_id").notNull(),
    displayName: text("display_name"),
    linkedAt: tsNow("linked_at"),
  },
  (table) => [
    uniqueIndex("platform_link_uniq").on(table.platform, table.platformUserId),
    index("platform_link_user_idx").on(table.userId),
    index("platform_link_lookup_idx").on(table.platform, table.platformUserId),
  ],
);

// ─── Messaging Channel Config (per-org) ─────────────────

export const messagingChannels = sqliteTable(
  "messaging_channels",
  {
    id: uuidPk(),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    botToken: text("bot_token"),
    groupChatId: text("group_chat_id"),
    groupTitle: text("group_title"),
    botUsername: text("bot_username"),
    enabled: bool("enabled").default(false).notNull(),
    connectedAt: ts("connected_at"),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    uniqueIndex("messaging_channel_uniq").on(
      table.organizationId,
      table.platform,
    ),
  ],
);

export const authSessions = sqliteTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuidCol("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: ts("expires").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: uuidPk(),
  userId: uuidCol("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
});

// ─── Verification Tokens (stub for DrizzleAdapter) ──────

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: ts("expires").notNull(),
  },
  (table) => [
    uniqueIndex("verification_token_uniq").on(table.identifier, table.token),
  ],
);

// ─── Org Invites (seat-first invite system) ─────────────
//
//  Invite lifecycle (state machine):
//    admin creates invite
//        │
//        ▼
//    [PENDING] ── expiresAt reached ──► [EXPIRED]
//        │                                  │
//        │── admin revokes ──► [REVOKED]    │── admin regenerates ──► [PENDING]
//        │
//        ▼ (user enters correct 8-digit code)
//    [CLAIMING] (transient, via claim token)
//        │
//        ▼
//    [CLAIMED] → claimedAt set, acceptedByUserId set
//

export const orgInvites = sqliteTable(
  "org_invites",
  {
    id: uuidPk(),
    organizationId: uuidCol("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    role: text("role").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    claimedAt: ts("claimed_at"),
    revokedAt: ts("revoked_at"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    invitedByUserId: uuidCol("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedByUserId: uuidCol("accepted_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    index("org_invite_email_org_idx").on(table.email, table.organizationId),
    index("org_invite_org_idx").on(table.organizationId),
  ],
);

// ─── Job Queue ──────────────────────────────────────────
//
//  Job lifecycle:
//    dispatch() → pending → pop() → processing → handle()
//                   ▲                    │
//                   │ fail(backoff)       ├─ success → complete() [DELETE]
//                   └────────────────────├─ failure (retryable) → fail() → pending
//                                        └─ failure (final) → bury() → failed_jobs
//

export const jobs = sqliteTable(
  "jobs",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    queue: text("queue").default("default").notNull(),
    payload: json("payload").notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    organizationId: uuidCol("organization_id"),
    uniqueKey: text("unique_key"),
    lastError: text("last_error"),
    availableAt: tsNow("available_at"),
    reservedAt: ts("reserved_at"),
    createdAt: tsNow("created_at"),
  },
  (table) => [
    index("jobs_queue_status_available_idx").on(
      table.queue,
      table.status,
      table.availableAt,
    ),
    uniqueIndex("jobs_unique_key_idx").on(table.uniqueKey),
  ],
);

export const failedJobs = sqliteTable(
  "failed_jobs",
  {
    id: uuidPk(),
    jobName: text("job_name").notNull(),
    queue: text("queue").notNull(),
    payload: json("payload").notNull(),
    error: text("error").notNull(),
    organizationId: uuidCol("organization_id"),
    failedAt: tsNow("failed_at"),
  },
  (table) => [index("failed_jobs_name_idx").on(table.jobName)],
);

export const payments = sqliteTable("payments", {
  id: uuidPk(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("usd"),
  status: text("status").default("pending"), // pending | paid | failed | cancelled
  provider: text("provider").notNull(), // stripe | qpay | bank
  providerRef: text("provider_ref"),
  description: text("description"),
  userId: text("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  createdAt: tsNow("created_at"),
  paidAt: ts("paid_at"),
});
// ─── Relations ───────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  series: many(eventSeries),
  editions: many(eventEditions),
  userOrganizations: many(userOrganizations),
}));

export const eventSeriesRelations = relations(eventSeries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [eventSeries.organizationId],
    references: [organizations.id],
  }),
  editions: many(eventEditions),
}));

export const eventEditionsRelations = relations(
  eventEditions,
  ({ one, many }) => ({
    series: one(eventSeries, {
      fields: [eventEditions.seriesId],
      references: [eventSeries.id],
    }),
    organization: one(organizations, {
      fields: [eventEditions.organizationId],
      references: [organizations.id],
    }),
    tracks: many(tracks),
    sessions: many(sessions),
    speakers: many(speakerApplications),
    attendees: many(attendees),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  edition: one(eventEditions, {
    fields: [sessions.editionId],
    references: [eventEditions.id],
  }),
  track: one(tracks, {
    fields: [sessions.trackId],
    references: [tracks.id],
  }),
  speaker: one(speakerApplications, {
    fields: [sessions.speakerId],
    references: [speakerApplications.id],
  }),
  host: one(users, {
    fields: [sessions.hostId],
    references: [users.id],
  }),
}));

export const speakerApplicationsRelations = relations(
  speakerApplications,
  ({ one, many }) => ({
    edition: one(eventEditions, {
      fields: [speakerApplications.editionId],
      references: [eventEditions.id],
    }),
    contact: one(contacts, {
      fields: [speakerApplications.contactId],
      references: [contacts.id],
    }),
    sessions: many(sessions),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [users.contactId],
    references: [contacts.id],
  }),
  memberships: many(userOrganizations),
  platformLinks: many(userPlatformLinks),
}));

export const userPlatformLinksRelations = relations(
  userPlatformLinks,
  ({ one }) => ({
    user: one(users, {
      fields: [userPlatformLinks.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [userPlatformLinks.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const userOrganizationsRelations = relations(
  userOrganizations,
  ({ one }) => ({
    user: one(users, {
      fields: [userOrganizations.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [userOrganizations.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const orgInvitesRelations = relations(orgInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgInvites.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [orgInvites.invitedByUserId],
    references: [users.id],
    relationName: "invitedBy",
  }),
  acceptedBy: one(users, {
    fields: [orgInvites.acceptedByUserId],
    references: [users.id],
    relationName: "acceptedBy",
  }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  users: many(users),
  speakers: many(speakerApplications),
  attendees: many(attendees),
  volunteers: many(volunteerApplications),
  outreach: many(outreach),
}));
