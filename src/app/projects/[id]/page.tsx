"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Project } from '@/types/project'
import { Button } from '@/components/ui/button'
import { 
  DownloadCloud, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  RotateCcw
} from 'lucide-react'
import dynamic from 'next/dynamic'

const LidarViewer = dynamic(() => import('@/components/LidarViewer'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/40">
      <div className="animate-pulse space-y-4">
        <div className="h-32 w-32 bg-blue-500/10 rounded-lg mx-auto" />
        <p className="text-white/50 text-center">Loading viewer...</p>
      </div>
    </div>
  )
})

export default function ProjectView() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return
      try {
        const projectDoc = await getDoc(doc(db, 'projects', id as string))
        if (projectDoc.exists()) {
          setProject({ id: projectDoc.id, ...projectDoc.data() } as Project)
        }
      } catch (error) {
        console.error('Error fetching project:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProject()
  }, [id])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
      <div className="p-5 space-y-4">
        {/* Project Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white">{project?.name}</h1>
            <p className="text-white/70">
              Material: {project?.material === 'custom' ? project?.customMaterial : project?.material}
            </p>
          </div>
          
          <Button
            variant="outline"
            className="text-white border-white/10 hover:bg-white/10"
            onClick={() => window.history.back()}
          >
            Back to Projects
          </Button>
        </div>

        {/* LiDAR Viewer Container */}
        <div className="relative h-[calc(100vh-200px)] w-full bg-black/40 rounded-lg overflow-hidden">
          {project?.fileUrl ? (
            <>
              <LidarViewer fileUrl={project.fileUrl} />
              
              {/* Viewer Controls */}
              <div className="absolute top-4 right-4 flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/70 text-white"
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/50">No LiDAR data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
