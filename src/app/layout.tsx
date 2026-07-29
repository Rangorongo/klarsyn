import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Deklar — Hitta pengarna du missar i din deklaration",
  description:
    "Deklar hittar skatteavdrag och skattemissar du annars skulle missa i din svenska inkomstdeklaration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${inter.variable} ${newsreader.variable}`}>
      <body className="app-shell">
        <a href="#main-content" className="skip-link">
          Hoppa till huvudinnehåll
        </a>

        <header className="topbar">
          <div className="brand">
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
            <span>Deklar</span>
          </div>
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
        </header>

        {children}

        <footer className="app-footer">
          Deklar — hittar skatteavdrag och skattemissar i din svenska
          inkomstdeklaration. Ditt underlag lagras krypterat, aldrig ditt
          personnummer.
        </footer>
      </body>
    </html>
  );
}
