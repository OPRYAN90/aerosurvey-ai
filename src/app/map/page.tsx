"use client"

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'

// Import CesiumMap with no SSR
const CesiumMap = dynamic(
  () => import('@/components/CesiumMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-black/40">
        <div className="animate-pulse space-y-4">
          <div className="h-32 w-32 bg-blue-500/10 rounded-lg mx-auto" />
          <p className="text-white/50 text-center">Loading map...</p>
        </div>
      </div>
    )
  }
)

export default function MapPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
      <div className="p-5 space-y-5">
        <div>
          <h1 className="text-3xl font-bold text-white">3D Map</h1>
          <p className="text-white/70 mt-1">Interactive 3D mapping visualization</p>
        </div>

        <Card className="bg-black/50 border-white/10">
          <div className="h-[600px] w-full relative">
            <Suspense fallback={<div>Loading...</div>}>
              <CesiumMap />
            </Suspense>
          </div>
        </Card>
      </div>
    </main>
  )
} 