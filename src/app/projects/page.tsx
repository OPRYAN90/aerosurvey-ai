"use client"

import { useState, useEffect } from 'react'
import { Plus, Upload, Trash2 } from 'lucide-react'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject, ref as storageRef } from 'firebase/storage'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, getDoc } from 'firebase/firestore'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ConversionService } from '@/lib/conversion-service'

interface Project {
  id?: string
  name: string
  material: string
  customMaterial: string
  materialCost: string
  file?: File | null
  fileUrl?: string
  userId?: string
  createdAt?: string
  fileName?: string
  conversionStatus?: 'pending' | 'converting' | 'converted' | 'error';
  convertedUrl?: string;
  conversionProgress?: number;
  conversionError?: string;
}

const defaultMaterials = [
  { name: 'Asphalt Concrete', cost: 85 },
  { name: 'Portland Cement Concrete', cost: 90 },
  { name: 'Gravel', cost: 45 },
  { name: 'Composite Pavement', cost: 95 },
]

// Add the ConversionProgress component
function ConversionProgress({ progress, status }: { progress: number; status?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="w-64 text-center space-y-4">
        <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <div className="text-white space-y-1">
          <p className="font-medium">Converting Project</p>
          <p className="text-sm text-white/70">
            {status === 'converting' 
              ? `${Math.round(progress)}% complete`
              : status === 'pending'
              ? 'Preparing conversion...'
              : status === 'error'
              ? 'Conversion failed'
              : 'Processing...'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { user, isAuthReady } = useAuth()
  const router = useRouter()
  
  const [newProject, setNewProject] = useState<Project>({
    name: '',
    material: '',
    customMaterial: '',
    materialCost: '',
    file: null,
  })

  const [uploadProgress, setUploadProgress] = useState<{
    isUploading: boolean;
    fileName: string;
  }>({
    isUploading: false,
    fileName: '',
  });

  const [conversionStatus, setConversionStatus] = useState<Project['conversionStatus']>();
  const [conversionProgress, setConversionProgress] = useState<number>(0);

  useEffect(() => {
    const fetchProjects = async () => {
      console.log('Starting fetchProjects, user:', user?.uid)
      
      if (!user) {
        console.log('No user found, setting loading to false')
        setIsLoading(false)
        return
      }

      try {
        console.log('Querying Firestore for projects...')
        const q = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid)
        )
        const querySnapshot = await getDocs(q)
        console.log('Query complete, document count:', querySnapshot.size)
        
        const projectsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Project[]
        console.log('Processed projects data:', projectsData)
        
        setProjects(projectsData)
      } catch (error) {
        console.error('Error in fetchProjects:', error)
      } finally {
        console.log('Setting loading to false')
        setIsLoading(false)
      }
    }

    console.log('Projects useEffect triggered', {
      isAuthReady,
      userId: user?.uid,
      isLoading
    })

    if (isAuthReady) {
      fetchProjects()
    }
  }, [user, isAuthReady])

  const handleFileUpload = async (file: File) => {
    if (!user) return;

    setUploadProgress({ isUploading: true, fileName: file.name });
    const storageRef = ref(storage, `uploads/${user.uid}/${file.name}`);

    try {
      const snapshot = await uploadBytes(storageRef, file, {
        customMetadata: {
          'Content-Type': 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        }
      });
      const url = await getDownloadURL(snapshot.ref);
      
      setNewProject(prev => ({
        ...prev,
        fileUrl: url,
        fileName: file.name
      }));
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadProgress({ isUploading: false, fileName: '' });
    }
  };

  const handleCreateProject = async () => {
    try {
      if (!user) return;
      
      const token = await user.getIdToken();
      setConversionStatus('pending');
      setConversionProgress(0);
      
      const projectData = {
        name: newProject.name,
        material: newProject.material,
        customMaterial: newProject.customMaterial,
        materialCost: newProject.materialCost,
        fileUrl: newProject.fileUrl,
        fileName: newProject.fileName,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        conversionStatus: 'pending' as const,
        conversionProgress: 0
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      
      // Start watching conversion status
      const unsubscribe = ConversionService.watchConversionStatus(
        docRef.id,
        (updates) => {
          setConversionStatus(updates.conversionStatus);
          setConversionProgress(updates.conversionProgress || 0);
          
          // If conversion is complete or failed, close the dialog
          if (updates.conversionStatus === 'converted' || updates.conversionStatus === 'error') {
            setTimeout(() => {
              setIsCreating(false);
              setConversionStatus(undefined);
              setConversionProgress(0);
            }, 1000); // Give user a moment to see 100% completion
          }
        }
      );

      try {
        await ConversionService.startConversion(
          { ...projectData, id: docRef.id },
          token
        );
      } catch (error) {
        setConversionStatus('error');
        console.error('Conversion error:', error);
      }

      setProjects([...projects, { ...projectData, id: docRef.id }]);
      
      // Don't close dialog immediately - wait for conversion to complete
      setNewProject({
        name: '',
        material: '',
        customMaterial: '',
        materialCost: '',
        file: null,
      });

      // Cleanup subscription when dialog closes
      return () => unsubscribe();
    } catch (error) {
      console.error('Error creating project:', error);
      setConversionStatus('error');
    }
  };

  const handleDeleteProject = async (projectId: string, fileUrl?: string) => {
    if (!user || !projectId) return

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'projects', projectId))

      // Delete file from Storage if it exists
      if (fileUrl) {
        const fileRef = storageRef(storage, fileUrl)
        try {
          await deleteObject(fileRef)
        } catch (error) {
          console.error('Error deleting file:', error)
          // Continue with project deletion even if file deletion fails
        }
      }

      // Update local state
      setProjects(projects.filter(project => project.id !== projectId))
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  // Show loading state while fetching projects
  if (!isAuthReady || isLoading) {
    console.log('Rendering loading state', { isAuthReady, isLoading })
    return (
      <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
        <div className="p-5">
          <div className="flex justify-between items-center mb-8">
            <div className="animate-pulse">
              <div className="h-8 w-48 bg-white/10 rounded mb-2"></div>
              <div className="h-5 w-72 bg-white/5 rounded"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-10 w-36 bg-white/10 rounded"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className="bg-black/40 border-white/10 backdrop-blur-lg animate-pulse"
              >
                <CardHeader>
                  <div className="h-6 w-48 bg-white/10 rounded mb-3"></div>
                  <div className="h-4 w-32 bg-white/5 rounded mb-2"></div>
                  <div className="h-4 w-40 bg-white/5 rounded"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Add logging to main render
  console.log('Rendering projects view', {
    projectCount: projects.length,
    isCreating
  })

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
      <div className="p-5 space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            <p className="text-white/70 mt-1">Create and manage your road analysis projects</p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="bg-gray-900 border border-white/10 text-white max-h-[90vh] overflow-y-auto"
            >
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription className="text-white/70">
                  Fill in the project details to start your road analysis
                </DialogDescription>
              </DialogHeader>
              
              <div className="relative">
                {/* Show conversion progress if status is pending or converting */}
                {(conversionStatus === 'converting' || conversionStatus === 'pending') && (
                  <ConversionProgress 
                    progress={conversionProgress} 
                    status={conversionStatus}
                  />
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      placeholder="Enter project name"
                      className="bg-black/40 border-white/10 text-white"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Road Material</Label>
                    <Select 
                      onValueChange={(value) => setNewProject({ ...newProject, material: value })}
                    >
                      <SelectTrigger className="bg-black/40 border-white/10 text-white">
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10 text-white">
                        {defaultMaterials.map((material) => (
                          <SelectItem key={material.name} value={material.name}>
                            {material.name} (${material.cost}/m³)
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newProject.material === 'custom' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Custom Material Name</Label>
                        <Input
                          placeholder="Enter material name"
                          className="bg-black/40 border-white/10 text-white"
                          value={newProject.customMaterial}
                          onChange={(e) => setNewProject({ ...newProject, customMaterial: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost per Cubic Meter ($)</Label>
                        <Input
                          type="number"
                          placeholder="Enter cost"
                          className="bg-black/40 border-white/10 text-white"
                          value={newProject.materialCost}
                          onChange={(e) => setNewProject({ ...newProject, materialCost: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>LiDAR Data</Label>
                    <div className="border-2 border-dashed border-white/10 rounded-lg p-4 text-center hover:border-white/20 transition-colors">
                      <input
                        type="file"
                        id="lidar-file"
                        className="hidden"
                        accept=".las,.laz"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            setNewProject({ ...newProject, file });
                            handleFileUpload(file);
                          }
                        }}
                      />
                      <label htmlFor="lidar-file" className="cursor-pointer">
                        <div className="flex flex-col items-center gap-2">
                          {uploadProgress.isUploading ? (
                            <div className="flex items-center gap-2 text-white/70">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/70" />
                              <span className="text-sm truncate max-w-[200px]">
                                Uploading {uploadProgress.fileName}...
                              </span>
                            </div>
                          ) : newProject.file ? (
                            <div className="flex items-center gap-2 text-white/70">
                              <Upload className="w-5 h-5" />
                              <span className="text-sm truncate max-w-[200px]">
                                {newProject.file.name}
                              </span>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-white/70" />
                              <p className="text-sm text-white/70">Drop LiDAR files here or click to upload</p>
                              <p className="text-xs text-white/50">Supports .LAS and .LAZ files</p>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false);
                        setConversionStatus(undefined);
                        setConversionProgress(0);
                      }}
                      className="border-white/10 hover:bg-white/10 text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateProject}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={!newProject.name || !newProject.material || !newProject.file || conversionStatus === 'converting'}
                    >
                      Create Project
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid or Empty State */}
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="bg-black/40 border-white/10 backdrop-blur-lg hover:border-white/20 transition-all group cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-white">{project.name}</CardTitle>
                      <CardDescription className="text-white/70">
                        Material: {project.material === 'custom' ? project.customMaterial : project.material}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(project.id!, project.fileUrl)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {project.fileUrl && (
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-white/50">{project.fileName}</span>
                      <a 
                        href={project.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-400 hover:text-blue-500 underline transition-colors"
                      >
                        View Uploaded File
                      </a>
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <Plus className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-white/70 mb-6">Create your first project to get started</p>
          </div>
        )}
      </div>
    </main>
  )
}
