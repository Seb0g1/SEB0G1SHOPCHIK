import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avito Dropshipping Manager",
  description: "Single-user dashboard for Avito feed generation and publication control.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
