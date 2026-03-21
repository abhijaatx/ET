import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My ET + News Navigator",
  description: "AI-native financial news briefing and personalized feed"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f8f4ee_45%,_#efe6d8_100%)]">
          <div className="mx-auto max-w-6xl px-6 pb-24">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
