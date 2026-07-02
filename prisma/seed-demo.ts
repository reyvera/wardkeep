/**
 * Demo seed script — creates a demo user with 6 months of realistic financial data.
 * Run with: npx ts-node prisma/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@budgetapp.io';
const DEMO_PASSWORD = 'DemoPassword123';

// ─── Merchants and categories ────────────────────────────────────────────────

const MERCHANTS = {
  'Groceries': ['Whole Foods', 'Trader Joes', 'Kroger', 'Safeway', 'Costco', 'Aldi'],
  'Restaurants': ['Chipotle', 'Starbucks', 'McDonalds', 'Panera Bread', 'Olive Garden', 'Five Guys'],
  'Transportation': ['Shell Gas', 'BP Gas', 'Uber', 'Lyft', 'Metro Transit'],
  'Entertainment': ['Netflix', 'Spotify', 'AMC Theaters', 'Steam Games', 'Audible'],
  'Shopping': ['Amazon', 'Target', 'Walmart', 'Best Buy', 'Nike', 'H&M'],
  'Utilities': ['Electric Co', 'Water Utility', 'Comcast Internet', 'T-Mobile'],
  'Healthcare': ['CVS Pharmacy', 'Dr Smith Office', 'Blue Cross'],
  'Housing': ['Apt Rent LLC', 'State Farm Insurance'],
  'Subscriptions': ['iCloud Storage', 'ChatGPT Plus', 'GitHub Pro', 'Notion'],
};

const INCOME_SOURCES = ['Acme Corp Payroll', 'Freelance Client', 'Interest Payment'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(monthsAgo: number): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function main() {
  console.log('🌱 Seeding demo data...');

  // Clean existing demo user
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    // Delete all user data
    await prisma.transaction.deleteMany({ where: { account: { userId: existing.id } } });
    await prisma.budgetAllocation.deleteMany({ where: { budget: { userId: existing.id } } });
    await prisma.budget.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.category.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Create demo user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
    },
  });

  console.log(`  ✓ Created user: ${DEMO_EMAIL}`);

  // Create categories
  const categoryNames = [
    'Income', 'Groceries', 'Restaurants', 'Transportation', 'Entertainment',
    'Shopping', 'Utilities', 'Healthcare', 'Housing', 'Subscriptions', 'Savings',
  ];

  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const cat = await prisma.category.create({
      data: { name, userId: user.id, isDefault: false },
    });
    categories[name] = cat.id;
  }
  console.log(`  ✓ Created ${categoryNames.length} categories`);

  // Create accounts
  const checking = await prisma.account.create({
    data: { name: 'Chase Checking', type: 'CHECKING', userId: user.id, initialBalance: '4500.00' },
  });
  const savings = await prisma.account.create({
    data: { name: 'Ally Savings', type: 'SAVINGS', userId: user.id, initialBalance: '12000.00' },
  });
  const creditCard = await prisma.account.create({
    data: { name: 'Amex Blue Cash', type: 'CREDIT_CARD', userId: user.id, initialBalance: '1847.32' },
  });
  const mortgage = await prisma.account.create({
    data: { name: 'Home Mortgage', type: 'MORTGAGE', userId: user.id, initialBalance: '245000.00' },
  });

  console.log('  ✓ Created 4 accounts');

  // Generate 6 months of transactions
  let txCount = 0;
  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    // Income (2 paychecks per month)
    for (let i = 0; i < 2; i++) {
      const date = randomDate(monthOffset);
      date.setDate(i === 0 ? 1 : 15);
      await prisma.transaction.create({
        data: {
          accountId: checking.id,
          amount: '2800.00',
          type: 'CREDIT',
          date,
          merchant: 'Acme Corp Payroll',
          description: 'Bi-weekly salary',
          categoryId: categories['Income'],
        },
      });
      txCount++;
    }

    // Rent (1st of month)
    const rentDate = randomDate(monthOffset);
    rentDate.setDate(1);
    await prisma.transaction.create({
      data: {
        accountId: checking.id,
        amount: '1850.00',
        type: 'DEBIT',
        date: rentDate,
        merchant: 'Apt Rent LLC',
        description: 'Monthly rent',
        categoryId: categories['Housing'],
      },
    });
    txCount++;

    // Generate 60-80 random expenses per month
    const expenseCount = Math.floor(Math.random() * 20) + 60;
    for (let i = 0; i < expenseCount; i++) {
      const categoryName = pickRandom(Object.keys(MERCHANTS));
      const merchants = MERCHANTS[categoryName as keyof typeof MERCHANTS]!;
      const merchant = pickRandom(merchants);
      const account = Math.random() > 0.6 ? creditCard : checking;

      let amount: number;
      switch (categoryName) {
        case 'Groceries': amount = randomBetween(15, 180); break;
        case 'Restaurants': amount = randomBetween(5, 65); break;
        case 'Transportation': amount = randomBetween(8, 75); break;
        case 'Entertainment': amount = randomBetween(10, 50); break;
        case 'Shopping': amount = randomBetween(15, 200); break;
        case 'Utilities': amount = randomBetween(40, 150); break;
        case 'Healthcare': amount = randomBetween(15, 250); break;
        case 'Housing': amount = randomBetween(50, 200); break;
        case 'Subscriptions': amount = randomBetween(5, 30); break;
        default: amount = randomBetween(10, 100);
      }

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          amount: amount.toFixed(2),
          type: 'DEBIT',
          date: randomDate(monthOffset),
          merchant,
          description: `Purchase at ${merchant}`,
          categoryId: categories[categoryName],
        },
      });
      txCount++;
    }
  }

  console.log(`  ✓ Created ${txCount} transactions (6 months)`);

  // Create current month budget
  const now = new Date();
  const budgetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      month: budgetMonth,
    },
  });

  const allocations = [
    { categoryId: categories['Groceries']!, amount: '600.00' },
    { categoryId: categories['Restaurants']!, amount: '300.00' },
    { categoryId: categories['Transportation']!, amount: '200.00' },
    { categoryId: categories['Entertainment']!, amount: '150.00' },
    { categoryId: categories['Shopping']!, amount: '250.00' },
    { categoryId: categories['Utilities']!, amount: '350.00' },
    { categoryId: categories['Healthcare']!, amount: '100.00' },
    { categoryId: categories['Housing']!, amount: '1900.00' },
    { categoryId: categories['Subscriptions']!, amount: '80.00' },
  ];

  for (const alloc of allocations) {
    await prisma.budgetAllocation.create({
      data: { budgetId: budget.id, ...alloc },
    });
  }

  console.log(`  ✓ Created budget for ${budgetMonth} with ${allocations.length} allocations`);

  console.log('\n✅ Demo seed complete!');
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
