// Prisma 7 client setup.
//
// Two Prisma 7 changes are visible here (CLAUDE.md section 7, pitfall 3):
//   1. The client is generated into src/generated/prisma, not node_modules.
//   2. The datasource `url` no longer lives in schema.prisma. Migrate reads it from
//      prisma.config.ts; PrismaClient needs an explicit driver adapter instead.
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env.');

const adapter = new PrismaMariaDb({
  // A small pool is plenty: this is a single-instance library application.
  connectionLimit: 5,
  ...parseMysqlUrl(url),
});

export const prisma = new PrismaClient({ adapter });

function parseMysqlUrl(raw: string) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}
