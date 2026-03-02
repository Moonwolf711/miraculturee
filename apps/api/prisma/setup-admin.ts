import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'yiana00@gmail.com';
  const tempPassword = 'MiraCulture2026!';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`[setup-admin] User ${email} not found — skipping.`);
    return;
  }

  if (user.role === 'ADMIN') {
    console.log(`[setup-admin] ${email} is already ADMIN — skipping.`);
    return;
  }

  const passwordHash = await hash(tempPassword, 10);

  await prisma.user.update({
    where: { email },
    data: {
      role: 'ADMIN',
      passwordHash,
      emailVerified: true,
      isBanned: false,
    },
  });

  console.log(`[setup-admin] ${email} → ADMIN, password reset, email verified.`);
}

main()
  .catch((e) => {
    console.error('[setup-admin] Error:', e);
    // Don't exit(1) — let the server still start
  })
  .finally(() => prisma.$disconnect());
