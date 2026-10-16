import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MDPPA | Industry Intelligence",
  description: "Evidence-based motorcycle industry and regulatory monitoring. Internal proof of concept for MDPPA Board evaluation.",
  icons: {
    icon: "/mdppa-icon.png",
    shortcut: "/mdppa-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
