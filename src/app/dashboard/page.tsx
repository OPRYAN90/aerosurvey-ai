"use client"

import { useRouter } from 'next/navigation'
import { FolderPlus, ArrowRight } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function Dashboard() {
  const router = useRouter()
  // This would eventually come from your state management / backend
  const hasProjects = false

  if (!hasProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/40 border-white/10 backdrop-blur-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
              <FolderPlus className="w-8 h-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl text-white mb-2">No Projects Yet</CardTitle>
            <CardDescription className="text-white/70 mb-6">
              Start by creating your first road analysis project to view insights and analytics.
            </CardDescription>
            <Button 
              onClick={() => router.push('/projects')}
              className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
            >
              Go to Projects <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div>Dashboard with project insights</div>
    </div>
  )
}
