/**
 * Dialect-aware schema barrel file.
 *
 * TypeScript sees the PG types (for autocomplete and type checking).
 * At runtime, the correct dialect's table objects are exported based on DB_DIALECT.
 *
 * This ensures that insert/update/delete operations use the right column defaults
 * (e.g., crypto.randomUUID() for SQLite instead of gen_random_uuid() for PG).
 */
import { getDialect } from "./dialect";
import * as pg from "./schema.pg";
import * as sqlite from "./schema.sqlite";

const s: typeof pg = getDialect() === "sqlite" ? (sqlite as typeof pg) : pg;

// ─── Enums (PG-only, but exported for type compatibility) ───
export const speakerStatusEnum = pg.speakerStatusEnum;
export const sessionTypeEnum = pg.sessionTypeEnum;
export const editionStatusEnum = pg.editionStatusEnum;
export const agendaStatusEnum = pg.agendaStatusEnum;
export const queueStatusEnum = pg.queueStatusEnum;

// ─── Tables ─────────────────────────────────────────────────
export const organizations = s.organizations as typeof pg.organizations;
export const eventSeries = s.eventSeries as typeof pg.eventSeries;
export const eventEditions = s.eventEditions as typeof pg.eventEditions;
export const tracks = s.tracks as typeof pg.tracks;
export const speakerApplications = s.speakerApplications as typeof pg.speakerApplications;
export const sessions = s.sessions as typeof pg.sessions;
export const sponsorApplications = s.sponsorApplications as typeof pg.sponsorApplications;
export const attendees = s.attendees as typeof pg.attendees;
export const eventQueue = s.eventQueue as typeof pg.eventQueue;
export const venues = s.venues as typeof pg.venues;
export const outreach = s.outreach as typeof pg.outreach;
export const teams = s.teams as typeof pg.teams;
export const teamEntityTypes = s.teamEntityTypes as typeof pg.teamEntityTypes;
export const teamMembers = s.teamMembers as typeof pg.teamMembers;
export const tasks = s.tasks as typeof pg.tasks;
export const invitations = s.invitations as typeof pg.invitations;
export const volunteerApplications = s.volunteerApplications as typeof pg.volunteerApplications;
export const booths = s.booths as typeof pg.booths;
export const mediaPartners = s.mediaPartners as typeof pg.mediaPartners;
export const campaigns = s.campaigns as typeof pg.campaigns;
export const entityNotes = s.entityNotes as typeof pg.entityNotes;
export const checklistTemplates = s.checklistTemplates as typeof pg.checklistTemplates;
export const checklistItems = s.checklistItems as typeof pg.checklistItems;
export const notifications = s.notifications as typeof pg.notifications;
export const auditLog = s.auditLog as typeof pg.auditLog;
export const emailLog = s.emailLog as typeof pg.emailLog;
export const contacts = s.contacts as typeof pg.contacts;
export const users = s.users as typeof pg.users;
export const userOrganizations = s.userOrganizations as typeof pg.userOrganizations;
export const userPlatformLinks = s.userPlatformLinks as typeof pg.userPlatformLinks;
export const messagingChannels = s.messagingChannels as typeof pg.messagingChannels;
export const authSessions = s.authSessions as typeof pg.authSessions;
export const accounts = s.accounts as typeof pg.accounts;

// ─── Relations ──────────────────────────────────────────────
export const organizationsRelations = s.organizationsRelations;
export const eventSeriesRelations = s.eventSeriesRelations;
export const eventEditionsRelations = s.eventEditionsRelations;
export const sessionsRelations = s.sessionsRelations;
export const speakerApplicationsRelations = s.speakerApplicationsRelations;
export const usersRelations = s.usersRelations;
export const userPlatformLinksRelations = s.userPlatformLinksRelations;
export const userOrganizationsRelations = s.userOrganizationsRelations;
export const contactsRelations = s.contactsRelations;
