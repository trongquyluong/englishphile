import Link from "next/link";
import type { Role } from "@prisma/client";
import { BookOpenCheck, ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
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
  { href: "/diagnostic", label: "Diagnostic" },
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

export function Navbar({ user }: NavbarProps) {
  const canAdmin = isAdminUser(user);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-10 items-center gap-2 rounded-md pr-2 text-sm font-semibold">
          <span className="flex size-9 items-center justify-center rounded-md bg-foreground text-background">
            <BookOpenCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="text-base tracking-tight">Englishphile</span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 md:flex">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="min-h-10 rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <details className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground">
                Cá nhân
                <ChevronDown className="size-4" aria-hidden="true" />
              </summary>
              <div className="surface absolute left-0 mt-2 grid w-56 gap-1 rounded-xl p-2">
                {userLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm hover:bg-panel-muted">
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
          {canAdmin ? (
            <details className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground">
                Quản trị
                <ChevronDown className="size-4" aria-hidden="true" />
              </summary>
              <div className="surface absolute left-0 mt-2 grid w-64 gap-1 rounded-xl p-2">
                {adminLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm hover:bg-panel-muted">
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <details className="relative md:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-md px-2 text-ink-soft hover:bg-panel-muted">
              <Menu className="size-5" aria-hidden="true" />
              <span className="sr-only">Mở menu</span>
            </summary>
            <div className="surface absolute right-0 mt-2 grid w-56 gap-1 rounded-lg p-2">
              {[...mainLinks, ...(user ? userLinks : []), ...(canAdmin ? adminLinks : [])].map((link) => (
                <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm hover:bg-panel-muted">
                  {link.label}
                </Link>
              ))}
            </div>
          </details>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground sm:flex"
              >
                <UserRound className="size-4" aria-hidden="true" />
                <span>{user.displayName}</span>
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-strong">
                  {roleLabels[user.role]}
                </span>
              </Link>
              <form action={signOutAction}>
                <button
                  className="flex min-h-10 items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.96]"
                  type="submit"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/sign-in"
                className="min-h-10 rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground"
              >
                Đăng nhập
              </Link>
              <Link
                href="/auth/sign-up"
                className="min-h-10 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                Tạo tài khoản
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
