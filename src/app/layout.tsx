import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Layout } from '@/components/layout'
import { AuthProvider } from '@/contexts/auth-context'
import { NavbarProvider } from '@/contexts/navbar-context'

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
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black`}>
        <AuthProvider>
          <NavbarProvider>
            <Layout>
              {children}
            </Layout>
          </NavbarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
