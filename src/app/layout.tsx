import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function getMetadataBase() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return undefined;

  try {
    return new URL(appUrl);
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Englishphile",
    template: "%s | Englishphile",
  },
  description: "Nền tảng luyện chuyên Anh theo trình độ, phát hiện điểm yếu và gợi ý bài luyện phù hợp.",
  openGraph: {
    title: "Englishphile",
    description: "Diagnostic, Gym luyện tập, Contests và Wiki cho học sinh ôn chuyên Anh.",
    siteName: "Englishphile",
    locale: "vi_VN",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
