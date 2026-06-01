import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Bot ML — Dashboard",
  description: "Monitor en tiempo real del bot de trading algorítmico con ML",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
