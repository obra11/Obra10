import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL ?? process.env.DATABASE_PRIVATE_URL;

if (!url) {
  console.error(
    "FATAL: DATABASE_URL is not set. Ensure the environment variable is configured.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: url!,
  },
});
