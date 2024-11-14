"use client"

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Project } from '@/types/project'
import { Button } from '@/components/ui/button'
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  RotateCcw,
  AlertCircle
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Import PotreeViewer with NoSSR
const PotreeViewer = dynamic(
  () => import('@/components/PotreeViewer'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-black/40">
        <div className="animate-pulse space-y-4">
          <div className="h-32 w-32 bg-blue-500/10 rounded-lg mx-auto" />
          <p className="text-white/50 text-center">Loading viewer...</p>
        </div>
      </div>
    )
  }
)

// Add this interface near the top of the file with other imports
interface ViewerContainer extends HTMLDivElement {
  viewerControls?: {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    toggleFullscreen: () => void;
  }
}

export default function ProjectView() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loadingState, setLoadingState] = useState({
    isLoading: true,
    error: null as string | null
  })
  const containerRef = useRef<ViewerContainer>(null)

  useEffect(() => {
    let isMounted = true

    const fetchProject = async () => {
      if (!id) return

      try {
        setLoadingState(prev => ({ ...prev, isLoading: true }))
        
        const projectDoc = await getDoc(doc(db, 'projects', id as string))
        
        if (!isMounted) return

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
    return () => { isMounted = false }
  }, [id])

  const handleViewerError = (error: string) => {
    console.error('Viewer error:', error)
    setLoadingState(prev => ({
      ...prev,
      error
    }))
  }

  const renderContent = () => {
    if (loadingState.isLoading) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
            <p className="text-white/70">Loading project...</p>
          </div>
        </div>
      )
    }

    if (loadingState.error) {
      return (
        <div className="w-full h-full flex items-center justify-center">
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
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-white/50">No LiDAR data available</p>
        </div>
      )
    }

    return (
      <div className="relative w-full h-full" ref={containerRef}>
        <PotreeViewer 
          project={project}
          onError={handleViewerError}
        />
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={() => {
              const controls = containerRef.current?.viewerControls
              controls?.zoomIn()
            }}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={() => {
              const controls = containerRef.current?.viewerControls
              controls?.zoomOut()
            }}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={() => {
              const controls = containerRef.current?.viewerControls
              controls?.reset()
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={() => {
              const controls = containerRef.current?.viewerControls
              controls?.toggleFullscreen()
            }}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900">
      {/* LiDAR viewer container - now takes full height */}
      <div className="fixed top-14 left-0 right-0 bottom-0">
        {renderContent()}
      </div>
    </div>
  )
}
