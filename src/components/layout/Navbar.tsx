"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { BrandMark } from "@/components/layout/BrandMark";
import { NavLinks } from "@/components/layout/NavLinks";
import { roleLabels } from "@/lib/labels";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@prisma/client";

type NavbarProps = {
  user: {
    id: string;
    email: string;
    username: string | null;
    displayName: string;
    fullName: string | null;
    role: Role;
  } | null;
  canAdmin: boolean;
  showDiagnosticLink?: boolean;
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
  { href: "/admin/contests-builder", label: "Contest Builder" },
  { href: "/admin/wiki", label: "Wiki" },
  { href: "/admin/beta-checklist", label: "Beta Checklist" },
];

const summaryPillClass =
  "flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-full px-3.5 text-sm font-medium text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground";

// Dropdown component with click-outside and escape handling
function Dropdown({
  trigger,
  children,
  className = "w-56",
  alignRight = false,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={summaryPillClass}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {trigger}
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`surface absolute left-0 z-50 mt-2 grid gap-1 rounded-2xl p-2 ${className} ${alignRight ? "right-0 left-auto" : ""}`}
          onClick={(event) => {
            // Client-side navigation keeps the navbar mounted, so close the menu when an item is chosen.
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Navbar({ user, canAdmin, showDiagnosticLink = true }: NavbarProps) {
  // Diagnostic is onboarding-only: once finished, it leaves the main nav.
  const visibleUserLinks = showDiagnosticLink
    ? userLinks
    : userLinks.filter((link) => link.href !== "/diagnostic");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-full pr-2 font-semibold">
          <BrandMark />
          <span className="text-base tracking-tight">Englishphile</span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 md:flex" aria-label="Điều hướng chính">
          <NavLinks links={mainLinks} />
          {user ? (
            <Dropdown trigger="Cá nhân" className="w-56">
              {visibleUserLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm hover:bg-panel-muted">
                  {link.label}
                </Link>
              ))}
            </Dropdown>
          ) : null}
          {canAdmin ? (
            <Dropdown trigger="Quản trị" className="w-64">
              {adminLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2 text-sm hover:bg-panel-muted">
                  {link.label}
                </Link>
              ))}
            </Dropdown>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Dropdown trigger={<Menu className="size-5" />} className="w-60" alignRight>
            {[
              ...mainLinks,
              ...(user ? visibleUserLinks : [{ href: "/auth/sign-in", label: "Đăng nhập" }]),
              ...(canAdmin ? adminLinks : []),
            ].map((link) => (
              <Link key={link.href} href={link.href} className="rounded-xl px-3 py-2.5 text-sm hover:bg-panel-muted">
                {link.label}
              </Link>
            ))}
          </Dropdown>

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
