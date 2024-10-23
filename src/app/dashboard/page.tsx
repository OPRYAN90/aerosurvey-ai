"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Dashboard() {
  return (
    <main className="min-h-screen pt-20 bg-black p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-white">Welcome!</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70">
                This is a placeholder dashboard. Add your content here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
