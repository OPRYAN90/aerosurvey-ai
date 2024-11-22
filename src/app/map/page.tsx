"use client"

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const CesiumMap = dynamic(
  () => import('@/components/CesiumMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-screen flex items-center justify-center bg-black/40">
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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900">
      <div className="fixed top-14 left-0 right-0 bottom-0">
        <Suspense fallback={<div>Loading...</div>}>
          <CesiumMap />
        </Suspense>
      </div>
    </div>
  )
} 