import Link from "next/link";
import type { ReactNode } from "react";
import type { Role } from "@prisma/client";
import { Navbar } from "@/components/layout/Navbar";

type AppShellProps = {
  children: ReactNode;
  user: {
    id: string;
    email: string;
    username: string | null;
    displayName: string;
    fullName: string | null;
    role: Role;
  } | null;
};

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar user={user} />
      <main className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="mx-auto mt-8 flex w-full max-w-7xl flex-col gap-3 border-t border-line px-4 py-6 text-sm text-ink-soft sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p>Englishphile beta - luyện tập cá nhân hóa theo trình độ.</p>
        <nav className="flex flex-wrap gap-3">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
          <Link href="/status" className="hover:text-foreground">Status</Link>
        </nav>
      </footer>
    </div>
  );
}
