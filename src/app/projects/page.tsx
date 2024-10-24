"use client"

import { useState, useEffect } from 'react'
import { Plus, Upload } from 'lucide-react'
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '@/contexts/auth-context'

interface Project {
  id?: string
  name: string
  material: string
  customMaterial: string
  materialCost: string
  file?: File | null // Make file optional since it's not stored in Firestore
  fileUrl?: string
  userId?: string
  createdAt?: string
  fileName?: string
}

const defaultMaterials = [
  { name: 'Asphalt Concrete', cost: 85 },
  { name: 'Portland Cement Concrete', cost: 90 },
  { name: 'Gravel', cost: 45 },
  { name: 'Composite Pavement', cost: 95 },
]

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  
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

  // Fetch projects on component mount
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        console.log('Fetching projects for user:', user.uid) // Debug log
        const q = query(
          collection(db, 'projects'),
          where('userId', '==', user.uid)
        )
        const querySnapshot = await getDocs(q)
        const projectsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Project[]
        console.log('Fetched projects:', projectsData) // Debug log
        setProjects(projectsData)
      } catch (error) {
        console.error('Error fetching projects:', error)
        // Add more detailed error logging
        if (error instanceof Error) {
          console.error('Error details:', error.message)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [user])

  const handleFileUpload = async (file: File) => {
    if (!user) {
      console.error('No user found');
      return;
    }

    setUploadProgress({ isUploading: true, fileName: file.name });
    const storageRef = ref(storage, `uploads/${user.uid}/${file.name}`);

    try {
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      // Update newProject state with file info
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
    if (!user || !newProject.fileUrl) {
      console.error('No user or file URL found');
      return;
    }

    try {
      const projectData = {
        name: newProject.name,
        material: newProject.material,
        customMaterial: newProject.customMaterial,
        materialCost: newProject.materialCost,
        fileUrl: newProject.fileUrl,
        fileName: newProject.fileName,
        userId: user.uid,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);
      setProjects([...projects, { ...projectData, id: docRef.id }]);
      setIsCreating(false);
      setNewProject({
        name: '',
        material: '',
        customMaterial: '',
        materialCost: '',
        file: null,
      });
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  // Show loading state with a simpler loading indicator
  if (isLoading) {
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
    )
  }

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
            <DialogContent className="bg-gray-900 border border-white/10 text-white max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription className="text-white/70">
                  Fill in the project details to start your road analysis
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
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

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreating(false)}
                    className="border-white/10 hover:bg-white/10 text-black"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateProject}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                    disabled={!newProject.name || !newProject.material || !newProject.file}
                  >
                    Create Project
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <Card
              key={index}
              className="bg-black/40 border-white/10 backdrop-blur-lg hover:border-white/20 transition-all cursor-pointer"
            >
              <CardHeader>
                <CardTitle className="text-white">{project.name}</CardTitle>
                <CardDescription className="text-white/70">
                  Material: {project.material === 'custom' ? project.customMaterial : project.material}
                </CardDescription>
                {project.fileUrl && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-white/50">{project.fileName}</span>
                    <a href={project.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                      View Uploaded File
                    </a>
                  </div>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Empty State - Only show when not loading and no projects */}
        {!isLoading && projects.length === 0 && (
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
