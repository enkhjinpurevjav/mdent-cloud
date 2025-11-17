import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Get environment variables
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is required');
  }

  // Hash the admin password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Upsert the main branch
  const branch = await prisma.branch.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Main Branch',
      address: 'Ulaanbaatar, Mongolia',
    },
  });
  console.log('Branch created/updated:', branch);

  // Upsert the admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mdent.cloud' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'admin@mdent.cloud',
      password: hashedPassword,
      role: 'admin',
      branchId: branch.id,
    },
  });
  console.log('Admin user created/updated:', { id: admin.id, email: admin.email, role: admin.role });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
