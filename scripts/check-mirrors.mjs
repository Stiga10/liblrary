#!/usr/bin/env node
// Verify the duplicated Zod schemas have not drifted apart.
//
// The project is two independent folders (CLAUDE.md section 8), so validation rules
// live in backend/src/schemas/ AND frontend/src/lib/schemas.ts. A drifted rule is a
// real bug: the form accepts input the API then rejects. Comments and formatting are
// ignored; only the rules are compared.
//
// Also checks that bg.json and en.json carry the same key set.
import { readFileSync } from 'node:fs';

const SHARED = [
  ['createBookSchema', 'backend/src/schemas/book.ts'],
  ['updateBookSchema', 'backend/src/schemas/book.ts'],
  ['createReaderSchema', 'backend/src/schemas/reader.ts'],
  ['updateReaderSchema', 'backend/src/schemas/reader.ts'],
  ['issueLoanSchema', 'backend/src/schemas/loan.ts'],
];
const MIRROR = 'frontend/src/lib/schemas.ts';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Strip comments and collapse whitespace so only the rules remain. */
const normalise = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function extract(text, name) {
  // Matches both `z.object({...})` and `<other>.partial()` forms.
  const obj = text.match(new RegExp(`export const ${name} = z\\.object\\(\\{([\\s\\S]*?)\\n\\}\\)`));
  if (obj) return normalise(obj[1]);
  const derived = text.match(new RegExp(`export const ${name} = ([^;]+);`));
  return derived ? normalise(derived[1]) : null;
}

const mirror = read(MIRROR);
let failed = 0;

for (const [name, file] of SHARED) {
  const a = extract(read(file), name);
  const b = extract(mirror, name);
  if (a === null) { console.log(`? ${name}: not found in ${file}`); failed++; continue; }
  if (b === null) { console.log(`✗ ${name}: missing from ${MIRROR}`); failed++; continue; }
  if (a !== b) {
    console.log(`✗ ${name} has drifted:\n    ${file}: ${a}\n    ${MIRROR}: ${b}`);
    failed++;
  } else {
    console.log(`✓ ${name}`);
  }
}

// i18n key parity
const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
const bg = keys(JSON.parse(read('frontend/src/locales/bg.json'))).sort();
const en = keys(JSON.parse(read('frontend/src/locales/en.json'))).sort();
const onlyBg = bg.filter((k) => !en.includes(k));
const onlyEn = en.filter((k) => !bg.includes(k));
if (onlyBg.length || onlyEn.length) {
  console.log(`✗ i18n keys differ — only in bg: ${onlyBg.join(', ') || '-'}; only in en: ${onlyEn.join(', ') || '-'}`);
  failed++;
} else {
  console.log(`✓ i18n keys match (${bg.length} keys)`);
}

console.log(failed ? `\n${failed} problem(s) found.` : '\nAll mirrors are in sync.');
process.exit(failed ? 1 : 0);
