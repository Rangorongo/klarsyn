import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Klarsyn — Hitta pengarna du missar i din deklaration",
  description:
    "Klarsyn hittar skatteavdrag och skattemissar du annars skulle missa i din svenska inkomstdeklaration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={jakarta.variable}>
      <body className="app-shell">
        <a href="#main-content" className="skip-link">
          Hoppa till huvudinnehåll
        </a>

        <header className="topbar">
          <Link href="/" className="brand">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </svg>
            <span>Klarsyn</span>
          </Link>
          <nav className="topbar-nav">
            <Link href="/foretag" className="topbar-nav-link">
              För företag
            </Link>
            <span className="trust-pill">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
              </svg>
              Krypterat & säkert
            </span>
          </nav>
        </header>

        {children}

        <footer className="app-footer">
          Klarsyn — hittar skatteavdrag och skattemissar i din svenska
          inkomstdeklaration. Ditt underlag lagras krypterat, aldrig ditt
          personnummer.
        </footer>
      </body>
    </html>
  );
}
