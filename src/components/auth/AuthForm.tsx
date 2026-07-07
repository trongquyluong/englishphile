import Link from "next/link";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  action: (formData: FormData) => Promise<void>;
  error?: string;
};

export function AuthForm({ mode, action, error }: AuthFormProps) {
  const isSignUp = mode === "sign-up";

  return (
    <section className="mx-auto grid w-full max-w-md gap-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-accent">
          {isSignUp ? "Tạo hồ sơ luyện thi" : "Quay lại luyện tập"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {isSignUp ? "Đăng ký Englishphile" : "Đăng nhập"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          {isSignUp
            ? "Tạo tài khoản học viên để lưu diagnostic, bài luyện, lỗi sai và tiến độ cá nhân."
            : "Đăng nhập để tiếp tục Gym, diagnostic và gợi ý luyện tập."}
        </p>
      </div>

      <form action={action} className="surface grid gap-4 rounded-lg p-5">
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-danger">{error}</div>
        ) : null}

        {isSignUp ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Họ và tên
            <input
              required
              name="fullName"
              autoComplete="name"
              className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
              placeholder="Ví dụ: Minh Anh"
            />
          </label>
        ) : null}

        {isSignUp ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Tên người dùng
            <input
              required
              name="username"
              autoComplete="username"
              className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
              placeholder="minhanh09"
            />
          </label>
        ) : null}

        <label className="grid gap-1.5 text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
            placeholder="student@example.com"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Mật khẩu
          <input
            required
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
            placeholder="Ít nhất 8 ký tự"
          />
        </label>

        {isSignUp ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Xác nhận mật khẩu
            <input
              required
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
              placeholder="Nhập lại mật khẩu"
            />
          </label>
        ) : null}

        {isSignUp ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Trường
              <input
                name="school"
                className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
                placeholder="Tên trường"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Tỉnh / thành phố
              <input
                name="province"
                className="min-h-11 rounded-md bg-white px-3 text-sm shadow-[inset_0_0_0_1px_rgba(23,33,27,0.16)] focus-visible:outline-2"
                placeholder="Hà Nội"
              />
            </label>
          </div>
        ) : null}

        <FormSubmitButton className="mt-1 rounded-md" pendingLabel={isSignUp ? "Đang tạo tài khoản..." : "Đang đăng nhập..."}>
          {isSignUp ? "Tạo tài khoản" : "Đăng nhập"}
        </FormSubmitButton>
      </form>

      <p className="text-center text-sm text-ink-soft">
        {isSignUp ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
        <Link href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"} className="font-semibold text-accent-strong">
          {isSignUp ? "Đăng nhập" : "Đăng ký"}
        </Link>
      </p>
    </section>
  );
}
