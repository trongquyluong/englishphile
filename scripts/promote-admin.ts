import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = String(process.argv[2] ?? process.env.OWNER_EMAIL ?? "").trim().toLowerCase();

  if (!email) {
    console.error("Usage: npm run admin:promote -- email@example.com");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`Không tìm thấy user ${email}. Hãy đăng ký tài khoản bằng email này trước, rồi chạy lại script.`);
    return;
  }

  if (user.role === "ADMIN") {
    console.log(`${email} đã là ADMIN. Không có thay đổi.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`Đã promote ${email} từ ${user.role} lên ADMIN.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
