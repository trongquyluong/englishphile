import type { ReactNode } from "react";
import { requireContentAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireContentAdmin();
  return children;
}
