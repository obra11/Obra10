// Prisma config — loads .env for DATABASE_URL before running migrations
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Seed is run manually: npx ts-node prisma/seed.ts
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
