import { db } from "@/db";
import { contacts } from "@/db/schema";

/**
 * Find or create a contact by email. Returns the contact ID.
 * Uses INSERT ON CONFLICT to handle concurrent requests safely.
 */
export async function findOrCreateContact(data: {
  email: string;
  name: string;
  phone?: string | null;
  bio?: string | null;
  headshotUrl?: string | null;
  company?: string | null;
  title?: string | null;
  linkedin?: string | null;
  website?: string | null;
}): Promise<string> {
  const email = data.email.trim().toLowerCase();

  // Upsert: insert if new, touch updatedAt if exists — always returns the ID
  const [contact] = await db
    .insert(contacts)
    .values({
      name: data.name,
      email,
      phone: data.phone || null,
      bio: data.bio || null,
      headshotUrl: data.headshotUrl || null,
      company: data.company || null,
      title: data.title || null,
      linkedin: data.linkedin || null,
      website: data.website || null,
    })
    .onConflictDoUpdate({
      target: contacts.email,
      set: { updatedAt: new Date() },
    })
    .returning({ id: contacts.id });

  return contact.id;
}
