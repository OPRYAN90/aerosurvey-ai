'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { LogOut, LayoutDashboard, FolderOpen } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  
  const isAuthPage = pathname === '/signin' || pathname === '/login' || pathname === '/signup'
  const isAuthedRoute = pathname === '/dashboard' || pathname === '/projects'
  const isProjectViewPage = pathname.startsWith('/projects/') && pathname !== '/projects'

  if (isAuthPage) {
    return null
  }

  return (
    <div className={`
      ${isProjectViewPage 
        ? "fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-black/20 backdrop-blur-sm" 
        : "absolute top-0 left-0 right-0"
      } 
      z-50 ${!isProjectViewPage && "p-4"}
    `}>
      <div className={`
        ${isProjectViewPage ? "h-full px-4" : ""} 
        max-w-7xl mx-auto flex justify-between items-center
      `}>
        <Link href="/" className="flex items-center">
          <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
            AeroSurvey AI
          </span>
        </Link>
        
        {isAuthedRoute || isProjectViewPage ? (
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 mr-4">
              <Button
                variant="ghost"
                className="text-white hover:text-blue-400 transition-colors flex items-center gap-2"
                asChild
              >
                <Link href="/dashboard">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:text-blue-400 transition-colors flex items-center gap-2"
                asChild
              >
                <Link href="/projects">
                  <FolderOpen className="w-4 h-4" />
                  Projects
                </Link>
              </Button>
            </nav>
            <Button
              variant="ghost"
              onClick={signOut}
              className="text-white hover:text-red-400 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        ) : (
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