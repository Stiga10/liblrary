// Idempotent seed: safe to run repeatedly. See the db-schema skill, step 6.
//
// The admin account is created through the Better Auth API rather than a direct
// insert, so the password hash and the linked account row are correct. Public
// sign-up stays disabled; this script builds its own instance that allows it.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { createAuth } from '../src/lib/auth.js';

const BOOKS = [
  { isbn: '9789542805013', title: 'Под игото', author: 'Иван Вазов', totalQuantity: 5,
    description: 'Роман за българското Възраждане и Априлското въстание от 1876 година.' },
  { isbn: '9789542814023', title: 'Тютюн', author: 'Димитър Димов', totalQuantity: 3,
    description: 'Епопея за тютюневата индустрия и моралния разпад преди Втората световна война.' },
  { isbn: '9789542817024', title: 'Железният светилник', author: 'Димитър Талев', totalQuantity: 4,
    description: 'Първата част от тетралогията за македонските българи и рода Глаушеви.' },
  { isbn: '9789542823025', title: 'Бай Ганьо', author: 'Алеко Константинов', totalQuantity: 6,
    description: 'Сатирични фейлетони за нравите на българина след Освобождението.' },
  { isbn: '9789542831026', title: 'Време разделно', author: 'Антон Дончев', totalQuantity: 2,
    description: 'Роман за насилственото помохамеданчване в Родопите през XVII век.' },
  { isbn: '9789542845027', title: 'Балкански синдром', author: 'Станислав Стратиев', totalQuantity: 2,
    description: 'Сборник с пиеси и къси разкази с характерна абсурдистка ирония.' },
  { isbn: '9789542851028', title: 'Диви разкази', author: 'Николай Хайтов', totalQuantity: 4,
    description: 'Разкази за родопските хора, честта и суровия планински характер.' },
  { isbn: '9789542866029', title: 'Крадецът на праскови', author: 'Емилиян Станев', totalQuantity: 3,
    description: 'Новела за забранена любов във Велико Търново след Първата световна война.' },
  { isbn: '9789542871030', title: 'Стихотворения', author: 'Христо Ботев', totalQuantity: 5,
    description: 'Пълно събрание на поезията на революционера и поета.' },
  { isbn: '9789542884031', title: 'Записки по българските въстания', author: 'Захарий Стоянов', totalQuantity: 2,
    description: 'Документален разказ от първо лице за подготовката на Априлското въстание.' },
  { isbn: '9789542891032', title: 'Естествен роман', author: 'Георги Господинов', totalQuantity: 3,
    description: 'Фрагментарен роман за разпада на едно семейство и на един свят.' },
  { isbn: '9789542903033', title: 'Физика на тъгата', author: 'Георги Господинов', totalQuantity: 4,
    description: 'Роман за паметта, емпатията и лабиринтите на XX век.' },
  { isbn: '9789542911034', title: 'Възвишение', author: 'Милен Русков', totalQuantity: 2,
    description: 'Роман за двама четници преди Освобождението, написан на архаичен език.' },
  { isbn: '9789542925035', title: 'Хайка за вълци', author: 'Ивайло Петров', totalQuantity: 3,
    description: 'Роман за колективизацията в Добруджа, разказан от няколко гледни точки.' },
  { isbn: '9789542938036', title: 'Малката принцеса', author: 'Антоан дьо Сент-Екзюпери', totalQuantity: 7,
    description: 'Класическа философска приказка за пилота и малкия принц.' },
];

const READERS = [
  { cardNumber: 'CARD-0001', fullName: 'Мария Петрова', phone: '0888123456', email: 'maria.petrova@example.com' },
  { cardNumber: 'CARD-0002', fullName: 'Георги Иванов', phone: '0899234567', email: 'georgi.ivanov@example.com' },
  { cardNumber: 'CARD-0003', fullName: 'Елена Димитрова', phone: '0877345678', email: 'elena.dimitrova@example.com' },
  { cardNumber: 'CARD-0004', fullName: 'Николай Стоянов', phone: '0866456789' },
  { cardNumber: 'CARD-0005', fullName: 'Ана Тодорова', email: 'ana.todorova@example.com' },
];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in backend/.env');
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (existing) {
    // A user row with no linked account has no password and can never sign in.
    // That happens when sign-up fails partway through, so treat it as garbage and
    // rebuild rather than reporting success on an unusable account.
    if (existing.accounts.length === 0) {
      await prisma.user.delete({ where: { id: existing.id } });
      console.log(`  admin: removed unusable ${email} (user row with no credential)`);
    } else {
      if (existing.role !== 'ADMIN') {
        await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
        console.log(`  admin: promoted existing user ${email} to ADMIN`);
      } else {
        console.log(`  admin: ${email} already exists`);
      }
      return;
    }
  }

  const seedAuth = createAuth({ allowSignUp: true });
  await seedAuth.api.signUpEmail({
    body: { email, password, name: 'Администратор' },
  });
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  console.log(`  admin: created ${email} with role ADMIN`);
}

async function main() {
  console.log('Seeding...');

  await seedAdmin();

  for (const book of BOOKS) {
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: {},
      create: book,
    });
  }
  console.log(`  books: ${BOOKS.length} upserted`);

  for (const reader of READERS) {
    await prisma.reader.upsert({
      where: { cardNumber: reader.cardNumber },
      update: {},
      create: reader,
    });
  }
  console.log(`  readers: ${READERS.length} upserted`);

  // Two sample loans so the admin views are not empty on first run: one healthy,
  // one deliberately past its due date to exercise the derived overdue state.
  const [podIgoto, tyutyun] = await Promise.all([
    prisma.book.findUnique({ where: { isbn: '9789542805013' } }),
    prisma.book.findUnique({ where: { isbn: '9789542814023' } }),
  ]);
  const [maria, georgi] = await Promise.all([
    prisma.reader.findUnique({ where: { cardNumber: 'CARD-0001' } }),
    prisma.reader.findUnique({ where: { cardNumber: 'CARD-0002' } }),
  ]);

  if (podIgoto && maria) {
    const has = await prisma.loan.findFirst({
      where: { bookId: podIgoto.id, readerId: maria.id, status: 'ACTIVE' },
    });
    if (!has) {
      await prisma.loan.create({
        data: {
          bookId: podIgoto.id,
          readerId: maria.id,
          dueDate: new Date(Date.now() + 14 * 86_400_000),
        },
      });
      console.log('  loans: created one active loan');
    }
  }

  if (tyutyun && georgi) {
    const has = await prisma.loan.findFirst({
      where: { bookId: tyutyun.id, readerId: georgi.id, status: 'ACTIVE' },
    });
    if (!has) {
      await prisma.loan.create({
        data: {
          bookId: tyutyun.id,
          readerId: georgi.id,
          borrowDate: new Date(Date.now() - 30 * 86_400_000),
          dueDate: new Date(Date.now() - 16 * 86_400_000),
        },
      });
      console.log('  loans: created one overdue loan (dueDate in the past)');
    }
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
