import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "UniSphere — Salim Habib University",
    template: "%s · UniSphere",
  },
  description:
    "Unified university portal — timetable, exams, forms, complaints, internships, mentorship, FYP applications, and GPU/resource allocation in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ClerkProvider>
            <div className="flex min-h-dvh flex-1 flex-col">{children}</div>
            <Toaster position="top-right" closeButton richColors />
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
