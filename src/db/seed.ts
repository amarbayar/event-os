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

  // Admin user
  const { hash } = await import("../lib/password");
  const passwordHash = await hash("admin123");
  await db.insert(schema.users).values({
    name: "Amarbayar",
    email: "admin@devsummit.mn",
    passwordHash,
    organizationId: org.id,
    role: "owner",
  });
  console.log("  Admin user: admin@devsummit.mn / admin123");

  console.log("\nSeed complete!");
  console.log(`  Org: ${org.id}`);
  console.log(`  Edition: ${edition.id}`);

  await client.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
