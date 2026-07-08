import Link from "next/link";
import { BarChart3, Dumbbell, Gauge, RotateCcw, Sparkles, Trophy, TriangleAlert, UserRound } from "lucide-react";

const sidebarLinks = [
  { href: "/dashboard", label: "Tổng quan", icon: Gauge },
  { href: "/diagnostic", label: "Kiểm tra đầu vào", icon: Sparkles },
  { href: "/recommendations", label: "Gợi ý luyện tập", icon: RotateCcw },
  { href: "/gym", label: "Gym", icon: Dumbbell },
  { href: "/contests", label: "Contests", icon: Trophy },
  { href: "/analytics", label: "Thống kê", icon: BarChart3 },
  { href: "/wrong-questions", label: "Lỗi sai", icon: TriangleAlert },
  { href: "/practice/adaptive", label: "Luyện thích ứng", icon: RotateCcw },
  { href: "/profile", label: "Profile", icon: UserRound },
];

type SidebarProps = {
  showDiagnosticLink?: boolean;
};

export function Sidebar({ showDiagnosticLink = true }: SidebarProps) {
  const links = showDiagnosticLink
    ? sidebarLinks
    : sidebarLinks.filter((item) => item.href !== "/diagnostic");

  return (
    <aside className="surface hidden rounded-lg p-2 lg:block">
      <nav className="grid gap-1">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-[background-color,color] duration-150 hover:bg-panel-muted hover:text-foreground"
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
