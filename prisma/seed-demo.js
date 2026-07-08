/**
 * Demo seed script (plain JS — runs in production containers without ts-node).
 * Creates a demo user with 6 months of realistic financial data.
 * Skips seeding if the demo user already exists.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@wardkeep.app';
const DEMO_PASSWORD = 'DemoPassword123';

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

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(monthsAgo) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  // Skip if demo user already exists
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log('  ℹ Demo user already exists, skipping seed.');
    return;
  }

  console.log('  🌱 Seeding demo data...');

  // Create demo user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, passwordHash },
  });

  // Create categories
  const categoryNames = [
    'Income', 'Groceries', 'Restaurants', 'Transportation', 'Entertainment',
    'Shopping', 'Utilities', 'Healthcare', 'Housing', 'Subscriptions', 'Savings',
  ];

  const categories = {};
  for (const name of categoryNames) {
    const cat = await prisma.category.create({
      data: { name, userId: user.id, isDefault: false },
    });
    categories[name] = cat.id;
  }

  // Create accounts
  const checking = await prisma.account.create({
    data: { name: 'Chase Checking', type: 'CHECKING', userId: user.id, initialBalance: '4500.00' },
  });
  const creditCard = await prisma.account.create({
    data: { name: 'Amex Blue Cash', type: 'CREDIT_CARD', userId: user.id, initialBalance: '1847.32' },
  });
  await prisma.account.create({
    data: { name: 'Ally Savings', type: 'SAVINGS', userId: user.id, initialBalance: '12000.00' },
  });
  await prisma.account.create({
    data: { name: 'Home Mortgage', type: 'MORTGAGE', userId: user.id, initialBalance: '245000.00' },
  });

  // Generate 6 months of transactions
  let txCount = 0;
  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    // Income (2 paychecks per month)
    for (let i = 0; i < 2; i++) {
      const date = randomDate(monthOffset);
      date.setDate(i === 0 ? 1 : 15);
      await prisma.transaction.create({
        data: {
          userId: user.id,
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
        userId: user.id,
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
      const merchants = MERCHANTS[categoryName];
      const merchant = pickRandom(merchants);
      const account = Math.random() > 0.6 ? creditCard : checking;

      let amount;
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
          userId: user.id,
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

  // Create current month budget
  const now = new Date();
  const budgetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const budget = await prisma.budget.create({
    data: { userId: user.id, month: budgetMonth },
  });

  const allocations = [
    { categoryId: categories['Groceries'], amount: '600.00' },
    { categoryId: categories['Restaurants'], amount: '300.00' },
    { categoryId: categories['Transportation'], amount: '200.00' },
    { categoryId: categories['Entertainment'], amount: '150.00' },
    { categoryId: categories['Shopping'], amount: '250.00' },
    { categoryId: categories['Utilities'], amount: '350.00' },
    { categoryId: categories['Healthcare'], amount: '100.00' },
    { categoryId: categories['Housing'], amount: '1900.00' },
    { categoryId: categories['Subscriptions'], amount: '80.00' },
  ];

  for (const alloc of allocations) {
    await prisma.budgetAllocation.create({
      data: { budgetId: budget.id, ...alloc },
    });
  }

  console.log(`  ✓ Demo seeded: ${txCount} transactions, 4 accounts, ${allocations.length} budget items`);
  console.log(`  ✓ Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('  ⚠ Demo seed failed (non-fatal):', e.message);
  })
  .finally(() => prisma.$disconnect());
