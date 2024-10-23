"use client"

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, BarChart2, Database, Cpu } from 'lucide-react'

const DroneScene = dynamic(
  () => import('../components/ui/DroneScene').then(mod => ({ default: mod.DroneScene })), 
  { ssr: false }
)

function LoadingSpinner() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 border-4 border-t-blue-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-4 border-t-transparent border-r-blue-500 border-b-transparent border-l-cyan-500 rounded-full animate-spin-reverse"></div>
      </div>
    </div>
  )
}

export default function Homepage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isCameraMoving, setIsCameraMoving] = useState(false)

  // Add this function to handle camera movement
  const handleCameraMove = (isMoving: boolean) => {
    setIsCameraMoving(isMoving)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      {/* 3D Canvas Container - Now spans full viewport */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<LoadingSpinner />}>
          <Canvas
            shadows
            camera={{ position: [0, 12, 24], fov: 75 }}
            gl={{ antialias: true }}
            onCreated={() => setIsLoaded(true)}
            style={{ touchAction: 'none' }} // Ensures proper touch handling
          >
            <DroneScene 
              isAnimating={true} 
              onCameraMove={handleCameraMove}
            />
          </Canvas>
        </Suspense>
      </div>
      
      {/* Update the content overlay with transition based on camera movement */}
      <div className={`
        relative z-10 min-h-screen pointer-events-none
        transition-all duration-500 ease-in-out
        ${isCameraMoving ? 'opacity-0' : 'opacity-100'}
      `}>
        {/* Title Section */}
        <div className="h-[30vh] flex flex-col items-center justify-center p-8">
          <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500">
            LiDAR AI Explorer
          </h1>
          <p className="mt-6 text-2xl text-white/90 max-w-2xl text-center">
            Revolutionizing data processing with AI and LiDAR technology
          </p>
        </div>

        {/* Cards Section - Enable pointer events only for interactive elements */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
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
              ].map(({ icon: Icon, title, description }, index) => (
                <Card 
                  key={title} 
                  className={`
                    relative overflow-hidden
                    bg-black/40 border-white/10 backdrop-blur-lg
                    transform transition-all duration-500
                    hover:scale-105 hover:bg-black/60
                    pointer-events-auto
                    ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
                    transition-all duration-500 delay-${index * 200}
                  `}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-white">
                      <Icon className="h-6 w-6 text-blue-400" />
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-white/70 text-base">
                      {description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Button - Enable pointer events specifically for the button */}
            <div className="text-center">
              <Button 
                size="lg"
                className={`
                  pointer-events-auto
                  bg-gradient-to-r from-blue-500 to-cyan-500 
                  hover:from-blue-600 hover:to-cyan-600
                  text-white gap-2 px-8 py-6 text-lg
                  transform transition-all duration-500
                  hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25
                  ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
                `}
              >
                Explore Our Solutions
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
