"use client"

import React, { createContext, useContext, useState } from 'react'

interface NavbarContextType {
  isCollapsed: boolean
  isHovering: boolean
  setIsCollapsed: (value: boolean) => void
  setIsHovering: (value: boolean) => void
}

const NavbarContext = createContext<NavbarContextType | undefined>(undefined)

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  return (
    <NavbarContext.Provider value={{ 
      isCollapsed, 
      isHovering, 
      setIsCollapsed, 
      setIsHovering 
    }}>
      {children}
    </NavbarContext.Provider>
  )
}

export function useNavbar() {
  const context = useContext(NavbarContext)
  if (context === undefined) {
    throw new Error('useNavbar must be used within a NavbarProvider')
  }
  return context
}
