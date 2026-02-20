import type { Metadata } from "next";
import { Syne, Orbitron, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-logo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zenith Fitness",
  description: "AI-powered workout tracking and insights",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${orbitron.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* Decorative layers */}
        <div className="grid-pattern" />
        <div className="noise-overlay" />
        <div className="glow-sphere glow-sphere--lime" />
        <div className="glow-sphere glow-sphere--emerald" />

        {/* Floating shell */}
        <div className="shell">
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </div>
      </body>
    </html>
  );
}
