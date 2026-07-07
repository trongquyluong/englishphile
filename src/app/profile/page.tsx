import { UserRound } from "lucide-react";
import { updateProfileAction } from "@/app/profile/actions";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function fieldClass() {
  return "min-h-11 rounded-lg bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2";
}

export default async function ProfilePage({ searchParams }: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="surface rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-foreground text-background">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-accent">Profile</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">Hồ sơ học viên</h1>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Thông tin này giúp Englishphile cá nhân hóa trải nghiệm luyện tập và hiển thị hồ sơ gọn gàng hơn.
        </p>
      </header>

      {message ? <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong">{message}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      <form action={updateProfileAction} className="surface grid gap-4 rounded-2xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            Tên người dùng
            <input name="username" required defaultValue={user.username ?? ""} className={fieldClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Email
            <input value={user.email} disabled className={`${fieldClass()} text-ink-soft`} />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-semibold">
          Họ và tên
          <input name="fullName" required defaultValue={user.fullName ?? user.displayName} className={fieldClass()} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            Trường
            <input name="school" defaultValue={profile?.school ?? ""} className={fieldClass()} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Tỉnh / thành phố
            <input name="province" defaultValue={profile?.province ?? ""} className={fieldClass()} />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-semibold">
          Mục tiêu thi
          <input name="targetExam" defaultValue={profile?.targetExam ?? ""} className={fieldClass()} placeholder="VD: Chuyên Anh, HSG tỉnh, IELTS nền tảng..." />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold">
          Bio
          <textarea name="bio" defaultValue={profile?.bio ?? ""} className="min-h-28 rounded-lg bg-white p-3 text-sm leading-6 shadow-[inset_0_0_0_1px_rgba(23,33,27,0.14)] focus-visible:outline-2" />
        </label>

        <FormSubmitButton pendingLabel="Đang lưu hồ sơ...">Lưu hồ sơ</FormSubmitButton>
      </form>
    </div>
  );
}
