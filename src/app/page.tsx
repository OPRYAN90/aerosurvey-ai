"use client"

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, BarChart2, Database, Cpu } from 'lucide-react'

// Dynamically import DroneScene with no SSR
const DroneScene = dynamic(
  () => import('../components/ui/DroneScene').then(mod => ({ default: mod.DroneScene })), 
  { ssr: false }
)

export default function Homepage() {
  const [isAnimating, setIsAnimating] = useState(true)

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* 3D Canvas Container */}
      <div className="absolute inset-0 bg-black">
        <Suspense fallback={<div className="w-full h-full bg-black" />}>
          <Canvas
            shadows
            camera={{ position: [5, 5, 10], fov: 75 }}
            gl={{ antialias: true }}
          >
            <DroneScene isAnimating={isAnimating} />
          </Canvas>
        </Suspense>
        
        <Button
          variant="ghost"
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white"
          onClick={() => setIsAnimating(!isAnimating)}
        >
          {isAnimating ? 'Pause' : 'Play'}
        </Button>
      </div>
      
      {/* Content Overlay */}
      <div className="relative z-10 max-w-4xl mx-auto p-4 pt-8">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4 text-white">LiDAR AI Explorer</h1>
          <p className="text-xl text-white/90">
            Revolutionizing data processing with AI and LiDAR technology
          </p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: BarChart2,
              title: "Data Analysis",
              description: "Advanced algorithms for real-time LiDAR data processing and visualization."
            },
            {
              icon: Database,
              title: "Big Data Management",
              description: "Efficient storage and retrieval of massive LiDAR datasets for quick access and analysis."
            },
            {
              icon: Cpu,
              title: "AI-Powered Insights",
              description: "Machine learning models that extract meaningful patterns and predictions from LiDAR data."
            }
          ].map(({ icon: Icon, title, description }) => (
            <Card key={title} className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Icon className="h-5 w-5" />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-white/70">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="text-center">
          <Button 
            size="lg"
            className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
          >
            Explore Our Solutions
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  )
}