"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { User, onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { setCookie, deleteCookie } from 'cookies-next'

interface AuthContextType {
  user: User | null
  isAuthReady: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthReady: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        setUser(user)
        setCookie('auth', 'true', {
          maxAge: 30 * 24 * 60 * 60, // 30 days
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        })
      } else {
        // User is signed out
        setUser(null)
        deleteCookie('auth')
      }
      setIsAuthReady(true)
    })

    return () => unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      await auth.signOut()
      deleteCookie('auth')
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Show loading state until auth is ready
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
        <div className="p-5 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70" />
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isAuthReady, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
