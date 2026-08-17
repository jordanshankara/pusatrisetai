/**
 * Migrasi kredensial admin lama (.env: ADMIN_EMAIL/ADMIN_PASSWORD) jadi baris `User` role=admin
 * pertama, supaya login lama TETAP jalan setelah pindah ke autentikasi multi-user (tabel User).
 * Idempotent — upsert berdasar email, aman dijalankan ulang.
 *
 * Jalankan sekali: `npx tsx scripts/bootstrap-admin-user.ts`
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("ADMIN_EMAIL / ADMIN_PASSWORD tidak ditemukan di .env — tidak ada yang di-bootstrap.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin", active: true },
    create: { email, displayName: "Admin PusatRiset", passwordHash, role: "admin", active: true },
  });

  console.log(`Admin siap: ${user.email} (id: ${user.id}, role: ${user.role}).`);
}

main()
  .catch((error) => {
    console.error("Bootstrap admin gagal:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
