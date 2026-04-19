import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { getDialect } from "@/db/dialect";
import {
  users,
  userOrganizations,
  orgInvites,
} from "@/db/schema";
import * as pgSchema from "@/db/schema.pg";
import * as sqliteSchema from "@/db/schema.sqlite";
import { eq, desc, and, isNull, gt } from "drizzle-orm";

// ─── Auth Provider Configuration ────────────────────────
//
//  AUTH_PROVIDER controls which login methods are shown:
//    "credentials" (default) — email/password only
//    "google"                — Google Sign-In only
//    "all"                   — both Google + email/password

const authProvider = process.env.AUTH_PROVIDER || "credentials";

/** Resolve the most recent org membership for a user */
async function getLatestMembership(userId: string) {
  return db.query.userOrganizations.findFirst({
    where: eq(userOrganizations.userId, userId),
    orderBy: [desc(userOrganizations.createdAt)],
  });
}

// Build providers list based on AUTH_PROVIDER env var
const providers = [];

if (authProvider !== "google") {
  providers.push(
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.passwordHash) return null;

        const { compare } = await import("@/lib/password");
        const valid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        const membership = await getLatestMembership(user.id);
        if (!membership) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: membership.role,
          organizationId: membership.organizationId,
          forcePasswordChange: user.forcePasswordChange,
        };
      },
    })
  );
}

if (authProvider !== "credentials" && process.env.GOOGLE_CLIENT_ID) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

const authAdapter =
  authProvider === "credentials"
    ? undefined
    : getDialect() === "sqlite"
      ? DrizzleAdapter(db, {
          usersTable: sqliteSchema.users,
          accountsTable: sqliteSchema.accounts,
          sessionsTable: sqliteSchema.authSessions,
          verificationTokensTable: sqliteSchema.verificationTokens,
        } as never)
      : DrizzleAdapter(db, {
          usersTable: pgSchema.users,
          accountsTable: pgSchema.accounts,
          sessionsTable: pgSchema.authSessions,
          verificationTokensTable: pgSchema.verificationTokens,
        } as never);

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // Required behind reverse proxy (Nginx)
  providers,
  // Only use DrizzleAdapter when Google OAuth is configured — it conflicts
  // with Credentials provider in some NextAuth v5 versions
  ...(authAdapter ? { adapter: authAdapter } : {}),
  session: {
    strategy: "jwt", // CRITICAL: must be explicit — DrizzleAdapter defaults to "database"
    maxAge: 8 * 60 * 60, // 8 hours (not the default 30 days)
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // For Google OAuth, check if user has an org membership.
        // If not, check for a pending invite via the claim flow.
        // The claim flow passes inviteId through the callback URL,
        // which is handled by the /claim/complete route after redirect.
        // Here we just allow the sign-in — the redirect to /claim/complete
        // handles membership creation.
        if (!user.id) return true;

        const membership = await getLatestMembership(user.id);
        if (membership) return true; // Returning user with existing membership

        // Check if there's a pending invite for this email
        const invite = await db.query.orgInvites.findFirst({
          where: and(
            eq(orgInvites.email, user.email!),
            isNull(orgInvites.claimedAt),
            isNull(orgInvites.revokedAt),
            gt(orgInvites.expiresAt, new Date())
          ),
        });

        if (invite) return true; // Has a pending invite, allow sign-in

        // No membership, no invite — deny sign-in
        return false;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        // Credentials path: user object from authorize() already has role/orgId
        if (user.role) {
          token.role = user.role;
          token.organizationId = user.organizationId;
          token.forcePasswordChange = user.forcePasswordChange ?? false;
        }
      }

      const userId = token.sub || user?.id;

      if (userId) {
        const [membership, currentUser] = await Promise.all([
          token.role ? null : getLatestMembership(userId),
          db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { forcePasswordChange: true },
          }),
        ]);

        // OAuth path: look up membership when role is missing
        if (!token.role && membership) {
          token.role = membership.role;
          token.organizationId = membership.organizationId;
        }

        token.forcePasswordChange = currentUser?.forcePasswordChange ?? false;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
        session.user.forcePasswordChange = token.forcePasswordChange;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
