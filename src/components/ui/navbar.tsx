"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { LogOut, LayoutDashboard, FolderOpen, ChevronUp, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  
  const isAuthPage = pathname === '/signin' || pathname === '/login' || pathname === '/signup'
  const isAuthedRoute = pathname === '/dashboard' || pathname === '/projects'

  if (isAuthPage) {
    return null
  }

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        isCollapsed ? "-translate-y-[calc(100%-4px)]" : "translate-y-0",
        isHovering && isCollapsed ? "translate-y-0" : ""
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
              AeroSurvey AI
            </span>
          </Link>
          
          {isAuthedRoute ? (
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

      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center cursor-pointer group hover:scale-110 transition-all duration-200"
      >
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-white transition-transform" />
        ) : (
          <ChevronUp className="w-4 h-4 text-white transition-transform" />
        )}
      </button>
    </div>
  )
}