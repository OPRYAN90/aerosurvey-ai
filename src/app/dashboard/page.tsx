"use client"

import { useRouter } from 'next/navigation'
import { FolderPlus, ArrowRight, Activity, Map, Clock, AlertTriangle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { useEffect, useState } from 'react'

interface ProjectStats {
  totalProjects: number
  activeProjects: number
  totalDistance: number
  averageIssuesPerKm: number
  recentActivity: {
    date: string
    description: string
  }[]
}

export default function Dashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<ProjectStats>({
    totalProjects: 3,
    activeProjects: 2,
    totalDistance: 150.5,
    averageIssuesPerKm: 2.3,
    recentActivity: [
      { date: '2024-03-20', description: 'New analysis completed for Highway 101' },
      { date: '2024-03-19', description: 'Started scan of Mountain View roads' },
      { date: '2024-03-18', description: 'Updated Downtown project data' },
    ]
  })

  // In a real implementation, you would fetch this data from your backend
  const hasProjects = stats.totalProjects > 0

  if (!hasProjects) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-20">
        <div className="min-h-[80vh] flex items-center justify-center p-4">
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
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-20">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Dashboard Overview</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-blue-500" />
                Projects
              </CardTitle>
              <CardDescription className="text-2xl font-bold text-white">
                {stats.totalProjects}
                <span className="text-sm font-normal text-white/70 ml-2">
                  ({stats.activeProjects} active)
                </span>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Map className="w-5 h-5 text-green-500" />
                Total Distance
              </CardTitle>
              <CardDescription className="text-2xl font-bold text-white">
                {stats.totalDistance} km
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Issues per KM
              </CardTitle>
              <CardDescription className="text-2xl font-bold text-white">
                {stats.averageIssuesPerKm}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-500" />
                Activity
              </CardTitle>
              <CardDescription className="text-2xl font-bold text-white">
                {stats.recentActivity.length} updates
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 text-white/70">
                  <div className="w-24 text-sm">{activity.date}</div>
                  <div>{activity.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
