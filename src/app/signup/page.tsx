"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import Link from 'next/link'
import { ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Add sign-up logic here
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md bg-black/40 border-white/10 backdrop-blur-lg shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-white">Create an Account</CardTitle>
            <CardDescription className="text-zinc-400">
              Join AeroSurvey AI and explore the future of LiDAR technology
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Full Name</Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white pl-10"
                    required
                  />
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white pl-10"
                    required
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/5 border-white/10 text-white pl-10 pr-10"
                    required
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" className="border-white/10" />
                <label htmlFor="terms" className="text-sm text-zinc-400">
                  I agree to the <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>
                </label>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Sign Up <ArrowRight className="ml-2" size={18} />
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-zinc-400">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 transition duration-300 ease-in-out">
                  Log in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  )
}