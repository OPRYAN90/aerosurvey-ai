import "./globals.css";
import { Navbar } from '@/components/ui/navbar'
import localFont from "next/font/local";
import type { Metadata } from "next";

// Metadata definition
export const metadata: Metadata = {
  title: "AeroSurvey AI",
  description: "LiDAR data processing with AI technology",
};

// Font definitions
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: 'swap',
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
