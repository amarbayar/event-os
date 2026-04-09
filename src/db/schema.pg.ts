import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  varchar,
  index,
  uniqueIndex,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────

export const speakerStatusEnum = pgEnum("speaker_status", [
  "pending",
  "accepted",
  "rejected",
  "waitlisted",
]);

export const sessionTypeEnum = pgEnum("session_type", [
  "talk",
  "workshop",
  "panel",
  "keynote",
  "break",
  "networking",
  "opening",
  "closing",
  "coffee",
  "lunch",
  "fireside",
  "lightning",
]);

export const editionStatusEnum = pgEnum("edition_status", [
  "draft",
  "published",
  "archived",
]);

export const agendaStatusEnum = pgEnum("agenda_status", ["draft", "published"]);

export const queueStatusEnum = pgEnum("queue_status", [
  "pending",
  "processing",
  "done",
  "failed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "stripe",
  "qpay",
  "bank",
]);

// ─── Organizations ───────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  contactEmail: varchar("contact_email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  brandColor: varchar("brand_color", { length: 7 }),
  logoUrl: text("logo_url"),
  botLanguage: varchar("bot_language", { length: 50 }).default("auto"), // auto | en | mn | ...
  botMood: varchar("bot_mood", { length: 50 }).default("professional"), // professional | friendly | sarcastic | nerdy | funny
  llmProvider: varchar("llm_provider", { length: 50 }), // gemini | zai | xai | ollama — null = use env var
  llmModel: varchar("llm_model", { length: 100 }), // e.g. glm-5, gemini-2.5-flash
  llmApiKey: varchar("llm_api_key", { length: 500 }), // encrypted in future, never returned in full
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Event Series ────────────────────────────────────────

export const eventSeries = pgTable("event_series", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Event Editions ──────────────────────────────────────

export const eventEditions = pgTable(
  "event_editions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => eventSeries.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    venue: varchar("venue", { length: 500 }),
    status: editionStatusEnum("status").default("draft").notNull(),
    agendaStatus: agendaStatusEnum("agenda_status").default("draft").notNull(),
    cfpOpen: boolean("cfp_open").default(false).notNull(),
    timezone: varchar("timezone", { length: 50 }).default("Asia/Ulaanbaatar"),
    agendaGapMinutes: integer("agenda_gap_minutes").default(5).notNull(),
    agendaStartTime: varchar("agenda_start_time", { length: 5 }).default(
      "09:00",
    ),
    agendaEndTime: varchar("agenda_end_time", { length: 5 }).default("18:00"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("edition_org_idx").on(table.organizationId),
    uniqueIndex("edition_slug_idx").on(table.slug),
  ],
);

// ─── Tracks ──────────────────────────────────────────────

export const tracks = pgTable("tracks", {
  id: uuid("id").defaultRandom().primaryKey(),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => eventEditions.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }), // hex color for UI tinting
  sortOrder: integer("sort_order").default(0).notNull(),
});

// ─── Speaker Applications ────────────────────────────────

export const speakerApplications = pgTable(
  "speaker_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    // Speaker info
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    company: varchar("company", { length: 255 }),
    title: varchar("title", { length: 255 }),
    linkedin: varchar("linkedin", { length: 255 }),
    website: varchar("website", { length: 255 }),
    // Talk info
    talkTitle: varchar("talk_title", { length: 500 }).notNull(),
    talkAbstract: text("talk_abstract"),
    talkType: sessionTypeEnum("talk_type").default("talk").notNull(),
    trackPreference: varchar("track_preference", { length: 255 }),
    slideUrl: text("slide_url"),
    requirements: jsonb("requirements").$type<string[]>(),
    requirementsNotes: text("requirements_notes"),
    // Review
    status: speakerStatusEnum("status").default("pending").notNull(),
    reviewScore: integer("review_score"), // average score from reviewers
    reviewNotes: text("review_notes"),
    // Pipeline (universal)
    source: varchar("source", { length: 50 }).default("intake").notNull(), // intake | outreach | sponsored
    stage: varchar("stage", { length: 50 }).default("lead").notNull(), // lead | engaged | confirmed | declined
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Meta
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("speaker_edition_status_idx").on(table.editionId, table.status),
    index("speaker_edition_stage_idx").on(table.editionId, table.stage),
    index("speaker_org_idx").on(table.organizationId),
  ],
);

// ─── Sessions ────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    trackId: uuid("track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    speakerId: uuid("speaker_id").references(() => speakerApplications.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    type: sessionTypeEnum("type").default("talk").notNull(),
    startTime: timestamp("start_time"),
    endTime: timestamp("end_time"),
    room: varchar("room", { length: 255 }),
    day: integer("day").default(1).notNull(), // day number of the event
    sortOrder: integer("sort_order").default(0).notNull(),
    hostId: uuid("host_id").references(() => users.id, {
      onDelete: "set null",
    }),
    panelSpeakerIds: jsonb("panel_speaker_ids").$type<string[]>(),
    durationMinutes: integer("duration_minutes").default(30).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("session_edition_time_idx").on(table.editionId, table.startTime),
    index("session_edition_speaker_idx").on(table.editionId, table.speakerId),
  ],
);

// ─── Sponsor Applications ────────────────────────────────

export const sponsorApplications = pgTable(
  "sponsor_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    logoUrl: text("logo_url"),
    packagePreference: varchar("package_preference", { length: 100 }),
    message: text("message"),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    stage: varchar("stage", { length: 50 }).default("lead").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("sponsor_org_idx").on(table.organizationId)],
);

// ─── Attendees ───────────────────────────────────────────

export const attendees = pgTable(
  "attendees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    ticketType: varchar("ticket_type", { length: 100 })
      .default("general")
      .notNull(),
    qrHash: varchar("qr_hash", { length: 64 }).notNull(),
    checkedIn: boolean("checked_in").default(false).notNull(),
    checkedInAt: timestamp("checked_in_at"),
    checkedInBy: varchar("checked_in_by", { length: 100 }), // station identifier
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    stage: varchar("stage", { length: 50 }).default("lead").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("attendee_edition_qr_idx").on(table.editionId, table.qrHash),
    index("attendee_org_idx").on(table.organizationId),
  ],
);

// ─── Event Queue ─────────────────────────────────────────

export const eventQueue = pgTable(
  "event_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: queueStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("queue_status_created_idx").on(table.status, table.createdAt),
  ],
);

// ─── Venues ──────────────────────────────────────────────

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    capacity: integer("capacity"),
    priceQuote: text("price_quote"), // free-text for negotiation notes
    status: varchar("status", { length: 50 }).default("identified").notNull(), // identified, contacted, negotiating, proposal_received, finalized, declined
    assignedTo: varchar("assigned_to", { length: 255 }), // organizer responsible
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    pros: text("pros"),
    cons: text("cons"),
    mainImageUrl: text("main_image_url"),
    interiorPhotos: jsonb("interior_photos").$type<string[]>(),
    exteriorPhotos: jsonb("exterior_photos").$type<string[]>(),
    floorPlanUrl: text("floor_plan_url"),
    notes: text("notes"),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    stage: varchar("stage", { length: 50 }).default("lead").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("venue_edition_idx").on(table.editionId),
    index("venue_org_idx").on(table.organizationId),
  ],
);

// ─── Outreach (proactive sourcing for any entity) ────────

export const outreach = pgTable(
  "outreach",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    targetType: varchar("target_type", { length: 50 }).notNull(), // speaker, sponsor, booth, volunteer, media
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    company: varchar("company", { length: 255 }),
    role: varchar("role", { length: 255 }), // their title/role
    status: varchar("status", { length: 50 }).default("identified").notNull(), // identified, contacted, interested, negotiating, confirmed, declined, converted
    assignedTo: varchar("assigned_to", { length: 255 }), // team member responsible
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastContactDate: timestamp("last_contact_date"),
    nextFollowUp: timestamp("next_follow_up"),
    source: varchar("source", { length: 255 }), // how we found them
    notes: text("notes"),
    convertedToId: uuid("converted_to_id"), // when they convert to a speaker/sponsor application
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("outreach_edition_type_idx").on(table.editionId, table.targetType),
    index("outreach_org_idx").on(table.organizationId),
    index("outreach_followup_idx").on(table.nextFollowUp),
  ],
);

// ─── Teams ───────────────────────────────────────────────

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  editionId: uuid("edition_id").references(() => eventEditions.id, {
    onDelete: "cascade",
  }), // nullable for org-wide RBAC teams
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(), // Program, Logistics, Sponsors, etc.
  color: varchar("color", { length: 7 }), // hex for UI
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Team → Entity Type Mapping (RBAC) ──────────────────

export const teamEntityTypes = pgTable(
  "team_entity_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // speaker, sponsor, venue, etc.
  },
  (table) => [
    uniqueIndex("team_entity_type_uniq").on(table.teamId, table.entityType),
  ],
);

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  role: varchar("role", { length: 100 }), // lead, member
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tasks ───────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).default("todo").notNull(), // todo, in_progress, done, blocked
    priority: varchar("priority", { length: 20 }).default("medium").notNull(), // low, medium, high, urgent
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assigneeName: varchar("assignee_name", { length: 255 }), // fallback if no user account
    dueDate: timestamp("due_date"),
    linkedEntityType: varchar("linked_entity_type", { length: 50 }), // speaker, sponsor, venue, session, etc.
    linkedEntityId: uuid("linked_entity_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("task_edition_team_idx").on(table.editionId, table.teamId),
    index("task_assignee_idx").on(table.assigneeId),
    index("task_due_idx").on(table.dueDate),
    index("task_org_idx").on(table.organizationId),
  ],
);

// ─── Invitations / Guest Allocations ─────────────────────

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    type: varchar("type", { length: 50 }).notNull(), // special_guest, speaker_invitee, organizer_invitee, student, vip
    invitedBy: varchar("invited_by", { length: 255 }), // who invited them
    sourceType: varchar("source_type", { length: 50 }), // speaker, organizer, direct
    sourceId: uuid("source_id"), // speaker or organizer who used their allocation
    status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, sent, accepted, declined
    qrHash: varchar("qr_hash", { length: 64 }),
    checkedIn: boolean("checked_in").default(false).notNull(),
    checkedInAt: timestamp("checked_in_at"),
    notes: text("notes"),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    stage: varchar("stage", { length: 50 }).default("lead").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invitation_edition_idx").on(table.editionId),
    index("invitation_org_idx").on(table.organizationId),
    index("invitation_source_idx").on(table.sourceType, table.sourceId),
    index("invitation_qr_idx").on(table.editionId, table.qrHash),
  ],
);

// ─── Volunteer Applications ──────────────────────────────

export const volunteerApplications = pgTable(
  "volunteer_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    headshotUrl: text("headshot_url"),
    role: varchar("role", { length: 100 }), // registration, stage, logistics, etc.
    availability: text("availability"), // which days/shifts
    experience: text("experience"),
    tshirtSize: varchar("tshirt_size", { length: 10 }),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    assignedShift: varchar("assigned_shift", { length: 255 }),
    notes: text("notes"),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    stage: varchar("stage", { length: 50 }).default("lead").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("volunteer_edition_idx").on(table.editionId),
    index("volunteer_org_idx").on(table.organizationId),
  ],
);

// ─── Booths ──────────────────────────────────────────────

export const booths = pgTable(
  "booths",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(), // e.g., "Booth A1"
    companyName: varchar("company_name", { length: 255 }),
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    companyLogoUrl: text("company_logo_url"),
    location: varchar("location", { length: 255 }), // e.g., "Hall B, Row 2"
    size: varchar("size", { length: 50 }), // small, medium, large, premium
    price: integer("price"), // in smallest currency unit
    status: varchar("status", { length: 50 }).default("available").notNull(), // available, reserved, confirmed, setup
    sponsorId: uuid("sponsor_id").references(() => sponsorApplications.id, {
      onDelete: "set null",
    }),
    equipment: text("equipment"), // power, wifi, table, chairs, etc.
    notes: text("notes"),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    stage: varchar("stage", { length: 50 }).default("lead").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("booth_edition_idx").on(table.editionId),
    index("booth_org_idx").on(table.organizationId),
  ],
);

// ─── Media Partners ──────────────────────────────────────

export const mediaPartners = pgTable(
  "media_partners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    type: varchar("type", { length: 100 }), // tv, online, print, podcast, blog
    reach: varchar("reach", { length: 255 }), // audience size / coverage area
    proposal: text("proposal"), // what they offer
    deliverables: text("deliverables"), // what we provide to them
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    logoUrl: text("logo_url"),
    notes: text("notes"),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    stage: varchar("stage", { length: 50 }).default("lead").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_edition_idx").on(table.editionId),
    index("media_org_idx").on(table.organizationId),
  ],
);

// ─── Marketing Campaigns ─────────────────────────────────

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(), // speaker_announcement, sponsor_promo, event_update, social_post
    platform: varchar("platform", { length: 100 }), // twitter, facebook, instagram, linkedin, telegram
    content: text("content"),
    scheduledDate: timestamp("scheduled_date"),
    publishedDate: timestamp("published_date"),
    status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, scheduled, published, cancelled
    speakerId: uuid("speaker_id").references(() => speakerApplications.id, {
      onDelete: "set null",
    }),
    sponsorId: uuid("sponsor_id").references(() => sponsorApplications.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    source: varchar("source", { length: 50 }).default("intake").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("campaign_edition_idx").on(table.editionId),
    index("campaign_org_idx").on(table.organizationId),
    index("campaign_scheduled_idx").on(table.scheduledDate),
  ],
);

// ─── Audit Log ───────────────────────────────────────────

// ─── Entity Notes / Discussion Thread ────────────────────

export const entityNotes = pgTable(
  "entity_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // speaker, sponsor, venue, etc.
    entityId: uuid("entity_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorName: varchar("author_name", { length: 255 }).notNull(),
    authorEmail: varchar("author_email", { length: 255 }),
    content: text("content").notNull(), // markdown supported
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("note_entity_idx").on(table.entityType, table.entityId),
    index("note_org_idx").on(table.organizationId),
  ],
);

// ─── Checklist Templates ─────────────────────────────────

export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    fieldKey: varchar("field_key", { length: 100 }), // maps to entity field (null for non-field items)
    itemType: varchar("item_type", { length: 50 }).notNull(), // file_upload, text_input, link, confirmation, meeting
    required: boolean("required").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    dueOffsetDays: integer("due_offset_days"),
    reminderTemplate: text("reminder_template"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("checklist_tpl_edition_idx").on(table.editionId, table.entityType),
  ],
);

// ─── Checklist Items ─────────────────────────────────────

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: "cascade" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => eventEditions.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    value: text("value"),
    submittedAt: timestamp("submitted_at"),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    reminderSentAt: timestamp("reminder_sent_at"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    editionId: uuid("edition_id").references(() => eventEditions.id, {
      onDelete: "cascade",
    }),
    type: varchar("type", { length: 100 }).notNull(), // assignment, checklist_submitted, stage_change, comment, team_added, entity_created
    title: varchar("title", { length: 500 }).notNull(),
    message: text("message"),
    link: varchar("link", { length: 500 }), // e.g., /speakers?open=<id>
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    actorName: varchar("actor_name", { length: 255 }), // who triggered the notification
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_user_idx").on(table.userId, table.read),
    index("notification_created_idx").on(table.createdAt),
  ],
);

// ─── Audit Log ───────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    action: varchar("action", { length: 50 }).notNull(), // create, update, delete
    changes: jsonb("changes"),
    actorId: varchar("actor_id", { length: 255 }), // user email or "service-token"
    source: varchar("source", { length: 20 }).default("web").notNull(), // web, telegram, api
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)],
);

// ─── Email Log ──────────────────────────────────────────

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    driver: varchar("driver", { length: 50 }).notNull(), // mailgun, postmark, log
    fromEmail: varchar("from_email", { length: 255 }).notNull(),
    toEmails: jsonb("to_emails").notNull(), // JSON array of email strings
    subject: varchar("subject", { length: 500 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(), // sent, failed, skipped
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    error: text("error"),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: uuid("entity_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 50 }),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    company: varchar("company", { length: 255 }),
    title: varchar("title", { length: 255 }),
    linkedin: varchar("linkedin", { length: 255 }),
    website: varchar("website", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("contact_email_idx").on(table.email)],
);

// ─── Users (for NextAuth) ────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  passwordHash: text("password_hash"),
  phone: varchar("phone", { length: 50 }),
  forcePasswordChange: boolean("force_password_change")
    .default(false)
    .notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  preferredLocale: varchar("preferred_locale", { length: 5 }).default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── User ↔ Organization Membership ─────────────────────

export const userOrganizations = pgTable(
  "user_organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).default("organizer").notNull(),
    linkedEntityType: varchar("linked_entity_type", { length: 50 }),
    linkedEntityId: uuid("linked_entity_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_org_uniq").on(table.userId, table.organizationId),
    index("user_org_user_idx").on(table.userId),
    index("user_org_org_idx").on(table.organizationId),
  ],
);

// ─── Messaging Channel Config (per-org) ─────────────────

export const messagingChannels = pgTable(
  "messaging_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }).notNull(), // telegram | discord | whatsapp
    botToken: text("bot_token"), // encrypted in prod, plaintext for now
    groupChatId: varchar("group_chat_id", { length: 100 }),
    groupTitle: varchar("group_title", { length: 255 }),
    botUsername: varchar("bot_username", { length: 255 }),
    enabled: boolean("enabled").default(false).notNull(),
    connectedAt: timestamp("connected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("messaging_channel_uniq").on(
      table.organizationId,
      table.platform,
    ),
  ],
);

// ─── User ↔ Platform Links (bot identity mapping) ──

export const userPlatformLinks = pgTable(
  "user_platform_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }).notNull(), // telegram | discord | whatsapp | slack
    platformUserId: varchar("platform_user_id", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    linkedAt: timestamp("linked_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_link_uniq").on(table.platform, table.platformUserId),
    index("platform_link_user_idx").on(table.userId),
    index("platform_link_lookup_idx").on(table.platform, table.platformUserId),
  ],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  idToken: text("id_token"),
  sessionState: varchar("session_state", { length: 255 }),
});

// ─── Verification Tokens (stub for DrizzleAdapter) ──────

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
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

export const orgInvites = pgTable(
  "org_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    role: varchar("role", { length: 50 }).notNull(), // admin|organizer|coordinator|viewer
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    claimedAt: timestamp("claimed_at"),
    revokedAt: timestamp("revoked_at"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const jobStatusEnum = pgEnum("job_status", ["pending", "processing"]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    queue: varchar("queue", { length: 100 }).default("default").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    organizationId: uuid("organization_id"),
    uniqueKey: varchar("unique_key", { length: 500 }),
    lastError: text("last_error"),
    availableAt: timestamp("available_at").defaultNow().notNull(),
    reservedAt: timestamp("reserved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const failedJobs = pgTable(
  "failed_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobName: varchar("job_name", { length: 255 }).notNull(),
    queue: varchar("queue", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    error: text("error").notNull(),
    organizationId: uuid("organization_id"),
    failedAt: timestamp("failed_at").defaultNow().notNull(),
  },
  (table) => [index("failed_jobs_name_idx").on(table.jobName)],
);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("usd"),
  status: paymentStatusEnum("status").default("pending"),
  provider: paymentProviderEnum("provider").notNull(),
  providerRef: text("provider_ref"), // stripe session id / payment intent id
  description: text("description"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
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
