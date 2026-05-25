import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEB0G1SHOPCHIK",
  description: "Avito product manager for catalog, variants, photos, API settings, and publication control.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
