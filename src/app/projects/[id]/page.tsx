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
  RotateCcw,
  AlertCircle
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
  const [loadingState, setLoadingState] = useState({
    isLoading: true,
    error: null as string | null
  })

  useEffect(() => {
    let isMounted = true // Add mounted check

    const fetchProject = async () => {
      if (!id || !isMounted) return

      try {
        setLoadingState(prev => ({ ...prev, isLoading: true }))
        
        const projectDoc = await getDoc(doc(db, 'projects', id as string))
        
        if (!isMounted) return // Check if still mounted

        if (!projectDoc.exists()) {
          setLoadingState({
            isLoading: false,
            error: 'Project not found'
          })
          return
        }

        const projectData = {
          id: projectDoc.id,
          ...projectDoc.data()
        } as Project

        if (!projectData.fileUrl) {
          setLoadingState({
            isLoading: false,
            error: 'No LiDAR file associated with this project'
          })
          return
        }

        if (isMounted) {
          setProject(projectData)
          setLoadingState({ isLoading: false, error: null })
        }

      } catch (error) {
        if (isMounted) {
          setLoadingState({
            isLoading: false,
            error: error instanceof Error 
              ? error.message 
              : 'Unable to load project'
          })
        }
      }
    }

    fetchProject()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [id])

  const handleError = (error: string) => {
    console.error('Viewer error:', error)
    setLoadingState(prev => ({
      ...prev,
      error
    }))
  }

  const renderContent = () => {
    console.log('ProjectView renderContent:', {
      isLoading: loadingState.isLoading,
      error: loadingState.error,
      hasProject: !!project,
      fileUrl: project?.fileUrl
    })
    
    if (loadingState.isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
            <p className="text-white/70">Loading project...</p>
          </div>
        </div>
      )
    }

    if (loadingState.error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-red-500 font-semibold">{loadingState.error}</p>
            <Button
              variant="outline"
              className="text-white border-white/10 hover:bg-white/10"
              onClick={() => window.history.back()}
            >
              Back to Projects
            </Button>
          </div>
        </div>
      )
    }

    if (!project?.fileUrl) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-white/50">No LiDAR data available</p>
        </div>
      )
    }

    return (
      <>
        <LidarViewer fileUrl={project.fileUrl} onError={handleError} />
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
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
      <div className="p-5 space-y-4">
        {project && (
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white">{project.name}</h1>
              <p className="text-white/70">
                Material: {project.material === 'custom' ? project.customMaterial : project.material}
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
        )}
        <div className="relative h-[calc(100vh-200px)] w-full bg-black/40 rounded-lg overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
