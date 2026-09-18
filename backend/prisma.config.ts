// Prisma 7 moved the connection URL out of schema.prisma into this file.
// The `url` property in a datasource block is no longer supported; Migrate reads
// the connection string from here, while PrismaClient gets a driver adapter
// (see src/lib/prisma.ts).
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
