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

  // One-time cleanup: un-verify artists who were test-verified but have no social accounts
  const { count } = await prisma.artist.updateMany({
    where: {
      isVerified: true,
      isPlaceholder: false,
      socialAccounts: { none: {} },
    },
    data: {
      isVerified: false,
      verificationStatus: 'UNVERIFIED',
      verifiedAt: null,
    },
  });
  if (count > 0) console.log(`[cleanup] Reverted ${count} incorrectly verified artist(s).`);
}

main()
  .catch((e) => {
    console.error('[setup-admin] Error:', e);
    // Don't exit(1) — let the server still start
  })
  .finally(() => prisma.$disconnect());
