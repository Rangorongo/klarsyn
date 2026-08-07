import type { DefaultSession } from "next-auth";

// Auth.js's default Session.user has no id — add it, since
// /api/account/delete and account/page.tsx both need it.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
