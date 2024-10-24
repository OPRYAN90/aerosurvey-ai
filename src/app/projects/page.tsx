"use client"

import { useState } from 'react'
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

interface Project {
  name: string
  material: string
  customMaterial: string
  materialCost: string
  file: File | null
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
  const [newProject, setNewProject] = useState<Project>({
    name: '',
    material: '',
    customMaterial: '',
    materialCost: '',
    file: null,
  })

  const handleCreateProject = () => {
    setProjects([...projects, newProject])
    setIsCreating(false)
    setNewProject({
      name: '',
      material: '',
      customMaterial: '',
      materialCost: '',
      file: null,
    })
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
            <DialogContent className="bg-gray-900 border border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription className="text-white/70">
                  Fill in the project details to start your road analysis
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
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
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:border-white/20 transition-colors">
                    <input
                      type="file"
                      id="lidar-file"
                      className="hidden"
                      accept=".las,.laz"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setNewProject({ ...newProject, file })
                      }}
                    />
                    <label htmlFor="lidar-file" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-white/70" />
                        <p className="text-white/70">Drop LiDAR files here or click to upload</p>
                        <p className="text-sm text-white/50">Supports .LAS and .LAZ files</p>
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
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {projects.length === 0 && (
          <div className="text-center py-8">
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
