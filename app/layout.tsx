import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autos Locos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
