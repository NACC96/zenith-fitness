import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
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
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
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
