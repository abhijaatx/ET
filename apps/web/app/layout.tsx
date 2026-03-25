import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "../components/Sidebar";
import { TrendingSidebar } from "../components/TrendingSidebar";
import { MobileNav } from "../components/MobileNav";

export const metadata: Metadata = {
  title: "News Navigator",
  description: "AI-native financial news in a social-first interface"
};

import { AuthorProfileProvider } from "../context/AuthorProfileContext";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-et-section font-sans">
        <AuthorProfileProvider>
          {children}
        </AuthorProfileProvider>

        {/* Mobile Navigation */}
        <MobileNav />
      </body>
    </html>
  );
}



