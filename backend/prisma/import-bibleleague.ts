// One-off import of five editions from bibleleague.bg (Библейска лига България).
//
// Idempotent, matched on title: these editions carry no ISBN on the source page,
// so there is nothing else stable to key on. Nothing is invented here - no ISBNs,
// no cover URLs (the project uploads covers manually), no page counts.
//
// `author` holds the issuing body. Bibles have no personal author, and using the
// corporate body is standard library practice for such works.
//
// `totalQuantity` is a PLACEHOLDER: the source is a shop, not a library holding,
// so these numbers do not come from anywhere real. Adjust them to actual stock.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const PUBLISHER = 'Библейска лига';

const EDITIONS = [
  {
    title: 'Семейна Библия – кожени корици',
    description:
      'Семейно издание на Библията с кожени корици. Голям формат, подходящ за домашна употреба и четене на глас. Издание на Библейска лига България.',
    totalQuantity: 2,
  },
  {
    title: 'Учебна Библия – Живо слово',
    description:
      'Учебно издание с помощни материали за изучаване на текста. Издание на Библейска лига България.',
    totalQuantity: 3,
  },
  {
    title: 'Библия – едър шрифт, твърди корици',
    description:
      'Издание с увеличен размер на шрифта и твърди корици — подходящо за продължително четене и за читатели с намалено зрение. Издание на Библейска лига България.',
    totalQuantity: 3,
  },
  {
    title: 'Новият завет съвременен превод',
    description:
      'Новият завет в съвременен български превод. Издание на Библейска лига България.',
    totalQuantity: 4,
  },
  {
    title: 'Библия – с препратки, луксозно издание, палци',
    description:
      'Луксозно издание с препратки между стиховете и изрязани палци за бърза навигация между книгите. Издание на Библейска лига България.',
    totalQuantity: 2,
  },
];

async function main() {
  console.log(`Внасям ${EDITIONS.length} издания от bibleleague.bg ...\n`);

  for (const edition of EDITIONS) {
    const existing = await prisma.book.findFirst({ where: { title: edition.title } });
    if (existing) {
      console.log(`  = вече съществува: ${edition.title}`);
      continue;
    }
    const created = await prisma.book.create({
      data: { ...edition, author: PUBLISHER },
    });
    console.log(`  + ${created.id}  ${created.title}  (${created.totalQuantity} бр.)`);
  }

  const total = await prisma.book.count();
  console.log(`\nОбщо книги в базата: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
