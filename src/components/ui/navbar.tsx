"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const pathname = usePathname()
  const isAuthPage = pathname === '/signin' || pathname === '/login'

  return (
    <div className="absolute top-0 left-0 right-0 z-50 p-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
            AeroSurvey AI
          </span>
        </Link>
        
        {!isAuthPage && (
          <div className="flex gap-4">
            <Button
              variant="ghost"
              className="text-white hover:text-blue-400 transition-colors"
              asChild
            >
              <Link href="/login">Login</Link>
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              asChild
            >
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
