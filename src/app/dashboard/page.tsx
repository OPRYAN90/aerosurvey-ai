"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogOut } from 'lucide-react'

export default function Dashboard() {
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <main className="min-h-screen pt-20 bg-black p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <Button
            onClick={signOut}
            variant="ghost"
            className="text-white hover:text-red-400"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-white">Welcome, {user?.displayName || 'User'}!</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70">
                This is your secure dashboard. Your email: {user?.email}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
