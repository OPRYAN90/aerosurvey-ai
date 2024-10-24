import "./globals.css";
import { Navbar } from '@/components/ui/navbar'
import localFont from "next/font/local";
import type { Metadata } from "next";
import { AuthProvider } from '@/contexts/auth-context'

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        {/* Fixed gradient background with adjusted colors */}
        <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-900 to-blue-900" />
        
        <AuthProvider>
          <div className="relative min-h-screen">
            <Navbar />
            <main>
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
