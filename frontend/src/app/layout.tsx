import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import ThemeApplier from "@/lib/ThemeApplier";

const ibmMono = IBM_Plex_Mono({ weight: ["300","400","500","600","700"], subsets: ["latin"], variable: "--font-ibm-plex-mono" });

export const metadata: Metadata = { title: "Chronic", description: "Fast, keyboard-first project manager" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${ibmMono.variable} antialiased text-[#E6E6F0]`}>
        <SessionProvider>
          <ThemeApplier />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
