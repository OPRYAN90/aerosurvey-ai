"use client"

import { useNavbar } from '@/contexts/navbar-context'
import { cn } from '@/lib/utils'
import { Navbar } from '@/components/ui/navbar'

export function Layout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isHovering } = useNavbar()

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900">
      <Navbar />
      <main
        className={cn(
          "transition-all duration-300 ease-in-out relative",
          isCollapsed && !isHovering ? "mt-[4px]" : "mt-[76px]" // Only show tiny margin for collapse button
        )}
      >
        {children}
      </main>
    </div>
  )
}