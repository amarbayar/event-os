import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "discord.js"],
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
