// Prisma 7 moved the connection URL out of schema.prisma into this file.
// The `url` property in a datasource block is no longer supported; Migrate reads
// the connection string from here, while PrismaClient gets a driver adapter
// (see src/lib/prisma.ts).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // The datasource block is omitted when DATABASE_URL is unset rather than built
  // with Prisma's env() helper, which resolves eagerly and aborts config loading
  // altogether. `prisma generate` reads only the schema and needs no connection,
  // so an eager failure breaks builds in environments that have no database --
  // CI being the obvious one. The block is optional precisely because only the
  // commands that connect (migrate, db pull, studio) require it, and those report
  // the missing URL themselves.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
