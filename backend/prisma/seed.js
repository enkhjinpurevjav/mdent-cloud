import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Get admin password from environment
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  // Hash the admin password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  // Create or update the default branch
  const branch = await prisma.branch.upsert({
    where: { name: 'Main Clinic' },
    update: {},
    create: {
      name: 'Main Clinic',
      address: 'Ulaanbaatar, Mongolia',
      phone: '+976-99999999',
    },
  });

  console.log(`✓ Branch created: ${branch.name} (${branch.id})`);

  // Create or update the admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mdent.cloud' },
    update: {
      passwordHash,
    },
    create: {
      email: 'admin@mdent.cloud',
      passwordHash,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      branchId: branch.id,
    },
  });

  console.log(`✓ Admin user created: ${adminUser.email} (${adminUser.id})`);
  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
