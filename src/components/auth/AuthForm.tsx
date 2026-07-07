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
        <p className="text-sm font-semibold text-accent">
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

      <form action={action} className="surface grid gap-4 rounded-3xl p-6">
        {error ? (
          <div className="rounded-2xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</div>
        ) : null}

        {isSignUp ? (
          <label className="grid gap-1.5 text-sm font-medium">
            Họ và tên
            <input
              required
              name="fullName"
              autoComplete="name"
              className="field min-h-11"
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
              className="field min-h-11"
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
            className="field min-h-11"
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
            className="field min-h-11"
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
              className="field min-h-11"
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
                className="field min-h-11"
                placeholder="Tên trường"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Tỉnh / thành phố
              <input
                name="province"
                className="field min-h-11"
                placeholder="Hà Nội"
              />
            </label>
          </div>
        ) : null}

        <FormSubmitButton className="mt-1" pendingLabel={isSignUp ? "Đang tạo tài khoản..." : "Đang đăng nhập..."}>
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
