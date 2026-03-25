import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { randomUUID, createHash } from "crypto";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://admin@localhost:5432/event_os";
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

function qrHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

async function seed() {
  console.log("Seeding database...");

  // Organization
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Dev Summit Mongolia", slug: "dev-summit-mn" })
    .returning();
  console.log("  Organization:", org.name);

  // Event Series
  const [series] = await db
    .insert(schema.eventSeries)
    .values({
      organizationId: org.id,
      name: "Dev Summit",
      slug: "dev-summit",
      description: "Mongolia's largest developer conference",
    })
    .returning();

  // Event Edition
  const [edition] = await db
    .insert(schema.eventEditions)
    .values({
      seriesId: series.id,
      organizationId: org.id,
      name: "Dev Summit 2026",
      slug: "dev-summit-2026",
      startDate: new Date("2026-03-28T09:00:00"),
      endDate: new Date("2026-03-29T18:00:00"),
      venue: "Chinggis Khaan Hotel, Ulaanbaatar",
      status: "published",
      agendaStatus: "draft",
      cfpOpen: true,
      timezone: "Asia/Ulaanbaatar",
    })
    .returning();
  console.log("  Edition:", edition.name);

  // Tracks
  const [mainTrack] = await db
    .insert(schema.tracks)
    .values({ editionId: edition.id, name: "Main Stage", color: "#eab308", sortOrder: 0 })
    .returning();
  const [workshopTrack] = await db
    .insert(schema.tracks)
    .values({ editionId: edition.id, name: "Workshop Room", color: "#047857", sortOrder: 1 })
    .returning();
  console.log("  Tracks: Main Stage, Workshop Room");

  // Speakers
  const speakerData = [
    { name: "Batbold T.", email: "batbold@datamn.mn", company: "DataMN", title: "CEO", talkTitle: "Opening Keynote: The Future of Tech in Mongolia", talkType: "keynote" as const, status: "accepted" as const, reviewScore: 48 },
    { name: "Sarah K.", email: "sarah@ossfoundation.org", company: "OSS Foundation", title: "Director", talkTitle: "Open Source in Central Asia", talkType: "talk" as const, status: "accepted" as const, reviewScore: 48 },
    { name: "Enkhbat D.", email: "enkhbat@num.edu.mn", company: "NUM University", title: "Professor", talkTitle: "Hands-on: ML Setup Workshop", talkType: "workshop" as const, status: "accepted" as const, reviewScore: 45 },
    { name: "James L.", email: "james@freelance.dev", company: "Freelance", title: "Senior Engineer", talkTitle: "DevOps for Small Teams", talkType: "talk" as const, status: "pending" as const, reviewScore: 31 },
    { name: "Nomindari S.", email: "nomindari@google.com", company: "Google Singapore", title: "Staff Engineer", talkTitle: "Building Scalable APIs with Go", talkType: "talk" as const, status: "accepted" as const, reviewScore: 49 },
    { name: "Altangerel B.", email: "altangerel@must.edu.mn", company: "MUST University", title: "Dr.", talkTitle: "AI Ethics and Responsible Development", talkType: "panel" as const, status: "waitlisted" as const, reviewScore: 42 },
    { name: "Oyungerel M.", email: "oyungerel@techstartup.mn", company: "TechStartup MN", title: "CTO", talkTitle: "From Prototype to Production in 30 Days", talkType: "talk" as const, status: "accepted" as const, reviewScore: 44 },
    { name: "Tserendorj A.", email: "tserendorj@cloudmn.com", company: "CloudMN", title: "Architect", talkTitle: "Cloud Infrastructure on a Budget", talkType: "talk" as const, status: "pending" as const, reviewScore: 38 },
    { name: "Munkhjin G.", email: "munkhjin@design.mn", company: "DesignMN", title: "UX Lead", talkTitle: "Designing for Emerging Markets", talkType: "talk" as const, status: "rejected" as const, reviewScore: 25 },
    { name: "Ganzorig B.", email: "ganzorig@blockchain.mn", company: "BlockchainMN", title: "Founder", talkTitle: "Web3 Workshop: Building Your First DApp", talkType: "workshop" as const, status: "pending" as const, reviewScore: 33 },
  ];

  const speakers = [];
  for (const s of speakerData) {
    const [speaker] = await db
      .insert(schema.speakerApplications)
      .values({
        editionId: edition.id,
        organizationId: org.id,
        ...s,
      })
      .returning();
    speakers.push(speaker);
  }
  console.log(`  Speakers: ${speakers.length} added`);

  // Sessions
  const acceptedSpeakers = speakers.filter((s) => s.status === "accepted");
  const sessionData = [
    { title: "Opening Keynote", type: "keynote" as const, startTime: "2026-03-28T09:00:00", endTime: "2026-03-28T09:45:00", day: 1, trackId: mainTrack.id, speakerId: acceptedSpeakers[0]?.id },
    { title: "Open Source in Central Asia", type: "talk" as const, startTime: "2026-03-28T10:00:00", endTime: "2026-03-28T10:30:00", day: 1, trackId: mainTrack.id, speakerId: acceptedSpeakers[1]?.id },
    { title: "Coffee Break + Networking", type: "break" as const, startTime: "2026-03-28T10:30:00", endTime: "2026-03-28T11:00:00", day: 1, trackId: null, speakerId: null },
    { title: "Building Scalable APIs with Go", type: "talk" as const, startTime: "2026-03-28T11:00:00", endTime: "2026-03-28T11:45:00", day: 1, trackId: mainTrack.id, speakerId: acceptedSpeakers[3]?.id },
    { title: "Hands-on: ML Setup Workshop", type: "workshop" as const, startTime: "2026-03-28T09:00:00", endTime: "2026-03-28T12:00:00", day: 1, trackId: workshopTrack.id, speakerId: acceptedSpeakers[2]?.id },
    { title: "Lunch Break", type: "break" as const, startTime: "2026-03-28T12:00:00", endTime: "2026-03-28T13:00:00", day: 1, trackId: null, speakerId: null },
    { title: "From Prototype to Production", type: "talk" as const, startTime: "2026-03-28T13:00:00", endTime: "2026-03-28T13:45:00", day: 1, trackId: mainTrack.id, speakerId: acceptedSpeakers[4]?.id },
    { title: "API Design Workshop", type: "workshop" as const, startTime: "2026-03-28T13:00:00", endTime: "2026-03-28T15:00:00", day: 1, trackId: workshopTrack.id, speakerId: null },
  ];

  for (const s of sessionData) {
    await db.insert(schema.sessions).values({
      editionId: edition.id,
      organizationId: org.id,
      ...s,
      startTime: s.startTime ? new Date(s.startTime) : null,
      endTime: s.endTime ? new Date(s.endTime) : null,
    });
  }
  console.log(`  Sessions: ${sessionData.length} added`);

  // Sponsors
  const sponsorData = [
    { companyName: "Khan Bank", contactName: "Bat-Erdene D.", contactEmail: "events@khanbank.mn", packagePreference: "Platinum", status: "confirmed" },
    { companyName: "Mobicom Corporation", contactName: "Oyunaa T.", contactEmail: "partnership@mobicom.mn", packagePreference: "Gold", status: "confirmed" },
    { companyName: "Golomt Bank", contactName: "Enkhbold S.", contactEmail: "csr@golomtbank.com", packagePreference: "Gold", status: "negotiating" },
    { companyName: "Unitel Group", contactName: "Sarnai B.", contactEmail: "marketing@unitel.mn", packagePreference: "Silver", status: "confirmed" },
    { companyName: "CloudMN", contactName: "Tserendorj A.", contactEmail: "info@cloudmn.com", packagePreference: "Bronze", status: "pending" },
  ];

  for (const s of sponsorData) {
    await db.insert(schema.sponsorApplications).values({ editionId: edition.id, organizationId: org.id, ...s });
  }
  console.log(`  Sponsors: ${sponsorData.length} added`);

  // Attendees (50)
  const firstNames = ["Bat-Erdene", "Oyungerel", "Temuulen", "Munkh-Erdene", "Dolgorsuren", "Enkhzul", "Ganzorig", "Bayarmaa", "Tserendorj", "Altantsetseg", "Munkhbayar", "Sarangerel", "Baatar", "Tsetsegmaa", "Erdenebat", "Solongo", "Munkhjin", "Narantsetseg", "Ganbaatar", "Oyunbileg", "Davaajav", "Enkhtuya", "Batbayar", "Uranchimeg", "Zorigt", "Tuya", "Bilguun", "Anu", "Sukhbat", "Tungalag", "Bold", "Gerelmaa", "Byambajav", "Ankhbayar", "Naranjargal", "Delger", "Otgonbayar", "Saruul", "Erdenechimeg", "Monkh-Orgil", "Lkhagvasuren", "Ariunaa", "Battulga", "Zolzaya", "Erkhembayar", "Nandin-Erdene", "Bayasgalan", "Soyolmaa", "Dulguun", "Enkhjin"];
  const ticketTypes = ["professional", "student", "student", "professional", "professional", "vip"];

  for (let i = 0; i < 50; i++) {
    const name = firstNames[i] + " " + String.fromCharCode(65 + (i % 26)) + ".";
    const email = firstNames[i].toLowerCase().replace(/-/g, "") + "@example.com";
    await db.insert(schema.attendees).values({
      editionId: edition.id,
      organizationId: org.id,
      name,
      email,
      ticketType: ticketTypes[i % ticketTypes.length],
      qrHash: qrHash(`${edition.id}-${email}`),
      checkedIn: i < 15, // first 15 already checked in
      checkedInAt: i < 15 ? new Date("2026-03-28T09:0" + (i % 10) + ":00") : null,
      checkedInBy: i < 15 ? "station-1" : null,
    });
  }
  console.log("  Attendees: 50 added (15 checked in)");

  // Venues
  const venueData = [
    { name: "Chinggis Khaan Hotel", address: "Tokyo Street 17, Ulaanbaatar", contactName: "Boldbaatar M.", contactEmail: "events@ckhotel.mn", capacity: 500, priceQuote: "$3,500/day — includes AV", status: "finalized", isFinalized: true, assignedTo: "Amarbayar" },
    { name: "Blue Sky Tower", address: "Peace Avenue, Ulaanbaatar", contactName: "Oyunaa S.", contactEmail: "events@bluesky.mn", capacity: 800, priceQuote: "$5,000/day", status: "proposal_received", isFinalized: false, assignedTo: "Tuvshin" },
    { name: "NUM University Hall", address: "University Street 1", contactName: "Prof. Batbayar", contactEmail: "batbayar@num.edu.mn", capacity: 300, priceQuote: "Free (partnership)", status: "negotiating", isFinalized: false, assignedTo: "Tuvshin" },
  ];

  for (const v of venueData) {
    await db.insert(schema.venues).values({ editionId: edition.id, organizationId: org.id, ...v });
  }
  console.log(`  Venues: ${venueData.length} added`);

  // Teams
  const teamData = [
    { name: "Program", color: "#eab308" },
    { name: "Logistics", color: "#0284c7" },
    { name: "Sponsors & Partners", color: "#047857" },
    { name: "Speakers", color: "#7c3aed" },
    { name: "Marketing", color: "#ea580c" },
  ];

  const teams = [];
  for (const t of teamData) {
    const [team] = await db.insert(schema.teams).values({ editionId: edition.id, organizationId: org.id, ...t }).returning();
    teams.push(team);
  }
  console.log(`  Teams: ${teams.length} added`);

  // Tasks
  const taskData = [
    { title: "Finalize keynote speaker contract", status: "in_progress", priority: "urgent", teamId: teams[3].id, assigneeName: "Amarbayar", dueDate: "2026-03-01" },
    { title: "Send venue deposit", status: "todo", priority: "high", teamId: teams[1].id, assigneeName: "Tuvshin", dueDate: "2026-02-20" },
    { title: "Design sponsor deck", status: "done", priority: "high", teamId: teams[2].id, assigneeName: "Sarnai", dueDate: "2026-02-15" },
    { title: "Book AV equipment", status: "todo", priority: "medium", teamId: teams[1].id, assigneeName: "Tuvshin", dueDate: "2026-03-20" },
    { title: "Speaker announcement posts", status: "in_progress", priority: "medium", teamId: teams[4].id, assigneeName: "Sarnai", dueDate: "2026-03-05" },
    { title: "Recruit student volunteers", status: "todo", priority: "medium", teamId: teams[1].id, assigneeName: "Dolgorsuren", dueDate: "2026-03-10" },
    { title: "Review remaining CFP applications", status: "blocked", priority: "high", teamId: teams[3].id, assigneeName: "Amarbayar", dueDate: "2026-02-28" },
    { title: "Set up check-in stations", status: "todo", priority: "high", teamId: teams[1].id, assigneeName: "Tuvshin", dueDate: "2026-03-25" },
  ];

  for (const t of taskData) {
    await db.insert(schema.tasks).values({
      editionId: edition.id,
      organizationId: org.id,
      ...t,
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
    });
  }
  console.log(`  Tasks: ${taskData.length} added`);

  // Team members
  const { hash } = await import("../lib/password");
  const passwordHash = await hash("admin123");
  const teamUsers = [
    { name: "Amarbayar", email: "admin@devsummit.mn", role: "owner" },
    { name: "Tuvshin", email: "tuvshin@devsummit.mn", role: "organizer" },
    { name: "Oyungerel", email: "oyungerel@devsummit.mn", role: "organizer" },
    { name: "Bat-Erdene", email: "baterdene@devsummit.mn", role: "coordinator" },
    { name: "Sarnai", email: "sarnai@devsummit.mn", role: "coordinator" },
  ];
  for (const u of teamUsers) {
    await db.insert(schema.users).values({
      name: u.name,
      email: u.email,
      passwordHash,
    });
  }
  const userRecords = await db.query.users.findMany({
    where: (u, { inArray }) => inArray(u.email, teamUsers.map(tu => tu.email)),
  });
  const userMap = Object.fromEntries(userRecords.map((u) => [u.name, u.id]));

  // User ↔ Organization memberships (mirrors legacy users.organizationId + role)
  for (const u of teamUsers) {
    const userId = userMap[u.name];
    if (userId) {
      await db.insert(schema.userOrganizations).values({
        userId,
        organizationId: org.id,
        role: u.role,
      });
    }
  }
  console.log(`  Users: ${teamUsers.length} team members (all password: admin123)`);

  // Org-wide RBAC teams (editionId = null)
  const rbacTeams = [
    { name: "Program", color: "#eab308", entityTypes: ["speaker", "session"], members: ["Amarbayar", "Tuvshin"] },
    { name: "Logistics", color: "#047857", entityTypes: ["venue", "booth"], members: ["Tuvshin", "Bat-Erdene"] },
    { name: "Sponsor/Partnership", color: "#0284c7", entityTypes: ["sponsor", "outreach"], members: ["Oyungerel"] },
    { name: "Operations", color: "#ea580c", entityTypes: ["volunteer", "media", "attendee"], members: ["Sarnai", "Bat-Erdene"] },
    { name: "Marketing", color: "#7c3aed", entityTypes: ["campaign"], members: ["Oyungerel", "Sarnai"] },
  ];

  for (const t of rbacTeams) {
    const [team] = await db.insert(schema.teams).values({
      organizationId: org.id,
      name: t.name,
      color: t.color,
      sortOrder: rbacTeams.indexOf(t),
    }).returning();

    // Entity type mappings
    for (const et of t.entityTypes) {
      await db.insert(schema.teamEntityTypes).values({
        teamId: team.id,
        entityType: et,
      });
    }

    // Team members
    for (const memberName of t.members) {
      const userId = userMap[memberName];
      if (userId) {
        await db.insert(schema.teamMembers).values({
          teamId: team.id,
          userId,
          name: memberName,
        });
      }
    }
  }
  console.log(`  Teams: ${rbacTeams.length} org-wide RBAC teams with entity type mappings`);

  // Checklist templates
  const checklistData: { entityType: string; name: string; fieldKey: string | null; itemType: string; required: boolean; sort: number; dueDays: number | null }[] = [
    // Speaker
    { entityType: "speaker", name: "Upload headshot photo", fieldKey: "headshotUrl", itemType: "file_upload", required: true, sort: 0, dueDays: -21 },
    { entityType: "speaker", name: "Submit speaker bio", fieldKey: "bio", itemType: "text_input", required: true, sort: 1, dueDays: -21 },
    { entityType: "speaker", name: "Confirm talk title & abstract", fieldKey: "talkTitle", itemType: "text_input", required: true, sort: 2, dueDays: -14 },
    { entityType: "speaker", name: "Upload/share slides", fieldKey: "slideUrl", itemType: "link", required: true, sort: 3, dueDays: -7 },
    { entityType: "speaker", name: "Confirm travel arrangements", fieldKey: null, itemType: "confirmation", required: false, sort: 4, dueDays: -14 },
    { entityType: "speaker", name: "Attend kickoff meeting", fieldKey: null, itemType: "meeting", required: false, sort: 5, dueDays: -14 },
    // Sponsor
    { entityType: "sponsor", name: "Upload company logo (high-res)", fieldKey: "logoUrl", itemType: "file_upload", required: true, sort: 0, dueDays: -21 },
    { entityType: "sponsor", name: "Submit company description", fieldKey: "message", itemType: "text_input", required: true, sort: 1, dueDays: -21 },
    { entityType: "sponsor", name: "Confirm booth preferences", fieldKey: null, itemType: "confirmation", required: true, sort: 2, dueDays: -14 },
    { entityType: "sponsor", name: "Submit branding guidelines", fieldKey: null, itemType: "file_upload", required: false, sort: 3, dueDays: -14 },
    // Venue
    { entityType: "venue", name: "Upload venue photos", fieldKey: "mainImageUrl", itemType: "file_upload", required: true, sort: 0, dueDays: -21 },
    { entityType: "venue", name: "Submit floor plan", fieldKey: "floorPlanUrl", itemType: "file_upload", required: true, sort: 1, dueDays: -14 },
    { entityType: "venue", name: "Confirm AV equipment list", fieldKey: null, itemType: "text_input", required: true, sort: 2, dueDays: -14 },
    { entityType: "venue", name: "Confirm catering arrangements", fieldKey: null, itemType: "confirmation", required: true, sort: 3, dueDays: -7 },
    // Booth
    { entityType: "booth", name: "Upload company logo", fieldKey: "companyLogoUrl", itemType: "file_upload", required: true, sort: 0, dueDays: -21 },
    { entityType: "booth", name: "Confirm booth size/location", fieldKey: null, itemType: "confirmation", required: true, sort: 1, dueDays: -14 },
    { entityType: "booth", name: "Submit electricity/internet requirements", fieldKey: null, itemType: "text_input", required: false, sort: 2, dueDays: -14 },
    // Volunteer
    { entityType: "volunteer", name: "Upload headshot photo", fieldKey: "headshotUrl", itemType: "file_upload", required: false, sort: 0, dueDays: -14 },
    { entityType: "volunteer", name: "Confirm availability dates", fieldKey: null, itemType: "confirmation", required: true, sort: 1, dueDays: -14 },
    { entityType: "volunteer", name: "Select preferred role/area", fieldKey: null, itemType: "text_input", required: true, sort: 2, dueDays: -14 },
    // Media
    { entityType: "media", name: "Upload media outlet logo", fieldKey: "logoUrl", itemType: "file_upload", required: true, sort: 0, dueDays: -21 },
    { entityType: "media", name: "Submit coverage plan", fieldKey: null, itemType: "text_input", required: true, sort: 1, dueDays: -14 },
    { entityType: "media", name: "Confirm press credentials", fieldKey: null, itemType: "confirmation", required: true, sort: 2, dueDays: -7 },
  ];

  for (const c of checklistData) {
    await db.insert(schema.checklistTemplates).values({
      editionId: edition.id,
      organizationId: org.id,
      entityType: c.entityType,
      name: c.name,
      fieldKey: c.fieldKey,
      itemType: c.itemType,
      required: c.required,
      sortOrder: c.sort,
      dueOffsetDays: c.dueDays,
    });
  }
  console.log(`  Checklist templates: ${checklistData.length} across 6 entity types`);

  console.log("\nSeed complete!");
  console.log(`  Org: ${org.id}`);
  console.log(`  Edition: ${edition.id}`);

  await client.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
