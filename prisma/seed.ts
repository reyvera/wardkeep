import { PrismaClient } from '@prisma/client';

const DEFAULT_CATEGORIES = [
  'Income',
  'Housing',
  'Utilities',
  'Groceries',
  'Transportation',
  'Healthcare',
  'Entertainment',
  'Dining',
  'Shopping',
  'Insurance',
  'Education',
  'Personal Care',
  'Gifts',
  'Subscriptions',
  'Debt Payment',
  'Savings',
  'Uncategorized',
] as const;

/**
 * Seeds default categories for a given user.
 * @param prisma - PrismaClient instance
 * @param userId - The user ID to attach categories to
 * @returns Array of created category records
 */
export async function seedCategories(prisma: PrismaClient, userId: string) {
  const categories = await Promise.all(
    DEFAULT_CATEGORIES.map(async (name) => {
      const existing = await prisma.category.findFirst({
        where: { userId, parentId: null, name },
      });
      if (existing) return existing;
      return prisma.category.create({
        data: { userId, name, isDefault: true },
      });
    }),
  );

  return categories;
}

/**
 * Main seed function — creates a test user and seeds default categories.
 * Only runs when executed directly (not when imported).
 */
async function main() {
  const prisma = new PrismaClient();

  try {
    // Create a test user for seeding purposes
    const testUser = await prisma.user.upsert({
      where: { email: 'seed@budgetapp.local' },
      update: {},
      create: {
        email: 'seed@budgetapp.local',
        passwordHash: 'seed-placeholder-hash',
      },
    });

    console.log(`Seeding categories for user: ${testUser.id}`);
    const categories = await seedCategories(prisma, testUser.id);
    console.log(`Created ${categories.length} default categories`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run main when executed directly
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
