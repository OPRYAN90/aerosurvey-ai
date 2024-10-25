"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Project } from '@/types/project'
import dynamic from 'next/dynamic'

// Dynamically import the LidarViewer component with SSR disabled
const LidarViewer = dynamic(
  () => import('@/components/LidarViewer'),
  { ssr: false }
)

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
        <div className="p-5">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-white/10 rounded mb-2"></div>
            <div className="h-5 w-72 bg-white/5 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
        <div className="p-5">
          <h1 className="text-white">Project not found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
      <div className="p-5">
        <h1 className="text-3xl font-bold text-white mb-2">{project?.name}</h1>
        <p className="text-white/70 mb-6">
          Material: {project?.material === 'custom' ? project?.customMaterial : project?.material}
        </p>
        <div className="h-[calc(100vh-200px)] w-full bg-black/40 rounded-lg overflow-hidden">
          {project?.fileUrl && <LidarViewer fileUrl={project.fileUrl} />}
        </div>
      </div>
    </div>
  )
}
