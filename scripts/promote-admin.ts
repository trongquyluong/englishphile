import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { classifySafeError } from "@/lib/operations/safe-error";

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
    console.log("Không tìm thấy tài khoản đã chọn. Hãy đăng ký tài khoản trước rồi chạy lại script.");
    return;
  }

  if (user.role === "ADMIN") {
    console.log("Tài khoản đã chọn đã là ADMIN. Không có thay đổi.");
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log("Đã cập nhật tài khoản đã chọn thành ADMIN.");
}

main()
  .catch((error) => {
    console.error(`Admin promotion failed (${classifySafeError(error)}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
