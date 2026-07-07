import Link from "next/link";
import type { Role } from "@prisma/client";
import { BookOpenCheck, ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { NavLinks } from "@/components/layout/NavLinks";
import { isAdminUser } from "@/lib/auth/session";
import { roleLabels } from "@/lib/labels";

type NavbarProps = {
  user: {
    id: string;
    email: string;
    username: string | null;
    displayName: string;
    fullName: string | null;
    role: Role;
  } | null;
};

const mainLinks = [
  { href: "/", label: "Trang chủ" },
  { href: "/gym", label: "Gym" },
  { href: "/contests", label: "Contests" },
  { href: "/wiki", label: "Wiki" },
  { href: "/about", label: "Về Englishphile" },
];

const userLinks = [
  { href: "/diagnostic", label: "Kiểm tra đầu vào" },
  { href: "/recommendations", label: "Gợi ý luyện tập" },
  { href: "/analytics", label: "Thống kê" },
  { href: "/wrong-questions", label: "Lỗi sai" },
  { href: "/profile", label: "Hồ sơ" },
];

const adminLinks = [
  { href: "/admin", label: "Admin Dashboard" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/content-packs", label: "Content Packs" },
  { href: "/admin/content-qa", label: "Content QA" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/problems", label: "Problems" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/topics", label: "Topic" },
  { href: "/admin/diagnostic", label: "Diagnostic Bank" },
  { href: "/admin/contests", label: "Contests" },
  { href: "/admin/wiki", label: "Wiki" },
  { href: "/admin/beta-checklist", label: "Beta Checklist" },
];

const summaryPillClass =
  "flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-full px-3.5 text-sm font-medium text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground";

export function Navbar({ user }: NavbarProps) {
  const canAdmin = isAdminUser(user);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-full pr-2 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent">
            <BookOpenCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="text-base tracking-tight">Englishphile</span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 md:flex" aria-label="Điều hướng chính">
          <NavLinks links={mainLinks} />
          {user ? (
            <details className="relative">
              <summary className={summaryPillClass}>
                Cá nhân
                <ChevronDown className="size-4" aria-hidden="true" />
              </summary>
              <div className="surface absolute left-0 mt-2 grid w-56 gap-1 rounded-2xl p-2">
                {userLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm hover:bg-panel-muted">
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
          {canAdmin ? (
            <details className="relative">
              <summary className={summaryPillClass}>
                Quản trị
                <ChevronDown className="size-4" aria-hidden="true" />
              </summary>
              <div className="surface absolute left-0 mt-2 grid w-64 gap-1 rounded-2xl p-2">
                {adminLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm hover:bg-panel-muted">
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <details className="relative md:hidden">
            <summary
              className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full text-ink-soft hover:bg-panel-muted"
              aria-label="Mở menu"
            >
              <Menu className="size-5" aria-hidden="true" />
              <span className="sr-only">Mở menu</span>
            </summary>
            <div className="surface absolute right-0 mt-2 grid w-60 gap-1 rounded-2xl p-2">
              {[
                ...mainLinks,
                ...(user ? userLinks : [{ href: "/auth/sign-in", label: "Đăng nhập" }]),
                ...(canAdmin ? adminLinks : []),
              ].map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2.5 text-sm hover:bg-panel-muted">
                  {link.label}
                </Link>
              ))}
            </div>
          </details>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden min-h-11 items-center gap-2 rounded-full px-3.5 text-sm text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground sm:flex"
              >
                <UserRound className="size-4" aria-hidden="true" />
                <span>{user.displayName}</span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                  {roleLabels[user.role]}
                </span>
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="btn btn-sm btn-secondary">
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Đăng xuất</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/sign-in" className="btn btn-sm btn-ghost hidden text-ink-soft sm:inline-flex">
                Đăng nhập
              </Link>
              <Link href="/auth/sign-up" className="btn btn-sm btn-primary">
                Tạo tài khoản
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
