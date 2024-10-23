"use client"

import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, SpotLight, useDepthBuffer, Stars } from '@react-three/drei'

export function DroneScene({ isAnimating }: { isAnimating: boolean }) {
  const droneGroup = useRef<THREE.Group>(null)
  const rotorsRef = useRef<THREE.Mesh[]>([])
  const sprayPointsRef = useRef<number[]>([])
  const sprayIntensitiesRef = useRef<number[]>([])
  const sprayGeometryRef = useRef(new THREE.BufferGeometry())
  const frame = useRef(0)
  const depthBuffer = useDepthBuffer({ frames: 1 })
  const { camera } = useThree()

  // Update initial camera position for horizontal view
  useEffect(() => {
    camera.position.set(30, 5, 0) // Positioned to the side
    camera.lookAt(0, 3, 0)
  }, [camera])

  // Modified drone path to follow directly above the road
  const dronePath = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4, -20),
      new THREE.Vector3(0, 4, -10),
      new THREE.Vector3(0, 4, 0),
      new THREE.Vector3(0, 4, 10),
      new THREE.Vector3(0, 4, 20),
    ], false) // Changed to false to prevent loop
    
    return curve
  }, [])

  // Animation loop with spray effect
  useFrame((state) => {
    if (!isAnimating || !droneGroup.current) return
    frame.current++

    // Smoother drone movement along path
    const time = ((frame.current * 0.001) % 1)
    const position = dronePath.getPointAt(time)
    const lookAhead = dronePath.getPointAt(Math.min(time + 0.01, 1))
    
    if (droneGroup.current) {
      // Update drone position
      droneGroup.current.position.copy(position)
      
      // Calculate direction vector
      const direction = new THREE.Vector3()
      direction.subVectors(lookAhead, position).normalize()
      
      // Add slight hover effect
      droneGroup.current.position.y += Math.sin(frame.current * 0.05) * 0.1
      
      // Update drone rotation to face direction of travel
      droneGroup.current.lookAt(lookAhead)
      
      // Add spray points
      if (frame.current % 2 === 0) { // Adjust frequency of spray points
        const spreadRadius = 0.5
        for (let i = 0; i < 5; i++) { // Create multiple points per frame
          const randomX = (Math.random() - 0.5) * spreadRadius
          const randomZ = (Math.random() - 0.5) * spreadRadius
          
          sprayPointsRef.current.push(
            position.x + randomX,
            0.1, // Just above the road
            position.z + randomZ
          )
          
          // Fade intensity based on age
          sprayIntensitiesRef.current.push(1.0)
        }
      }
    }

    // Rotor animation
    rotorsRef.current.forEach((rotor, i) => {
      if (rotor) {
        rotor.rotation.y += i % 2 ? 0.5 : -0.5
      }
    })

    // Update spray points
    // Fade out older points
    for (let i = 0; i < sprayIntensitiesRef.current.length; i++) {
      sprayIntensitiesRef.current[i] *= 0.99
    }

    // Remove old points
    const threshold = 0.1
    const validPoints: number[] = []
    const validIntensities: number[] = []
    
    for (let i = 0; i < sprayIntensitiesRef.current.length; i++) {
      if (sprayIntensitiesRef.current[i] > threshold) {
        validIntensities.push(sprayIntensitiesRef.current[i])
        validPoints.push(
          sprayPointsRef.current[i * 3],
          sprayPointsRef.current[i * 3 + 1],
          sprayPointsRef.current[i * 3 + 2]
        )
      }
    }

    sprayPointsRef.current = validPoints
    sprayIntensitiesRef.current = validIntensities

    // Update geometry
    sprayGeometryRef.current.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(sprayPointsRef.current, 3)
    )
    sprayGeometryRef.current.setAttribute(
      'intensity',
      new THREE.Float32BufferAttribute(sprayIntensitiesRef.current, 1)
    )
  })

  return (
    <>
      <color attach="background" args={[0x000000]} />
      <fog attach="fog" args={[0x000000, 30, 100]} />

      {/* Improved lighting setup */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[20, 30, 20]} 
        intensity={0.7} 
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Ground with grid */}
      <group position-y={-0.01}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial 
            color={0x111111}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>
        <gridHelper args={[100, 100, 0x333333, 0x222222]} />
      </group>

      {/* Main road */}
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[10, 80]} />
        <meshStandardMaterial 
          color={0x202020}
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>

      {/* Road markings */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh 
          key={i}
          rotation-x={-Math.PI / 2}
          position-y={0.01}
          position-z={i * 4 - 40}
        >
          <planeGeometry args={[0.2, 2]} />
          <meshStandardMaterial 
            color={0xffff00}
            emissive={0xffff00}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Drone group with improved design */}
      <group ref={droneGroup}>
        {/* Drone body */}
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.2, 1.2]} />
          <meshStandardMaterial 
            color={0x3498db}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Drone arms and rotors */}
        {[[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]].map((pos, i) => (
          <group key={i} position={[pos[0], 0, pos[1]]}>
            <mesh castShadow>
              <boxGeometry args={[0.1, 0.05, 0.6]} />
              <meshStandardMaterial color={0x2c3e50} />
            </mesh>
            
            <mesh 
              ref={(el) => { if (el) rotorsRef.current[i] = el }}
              position-y={0.05}
              castShadow
            >
              <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
              <meshStandardMaterial color={0x95a5a6} />
            </mesh>
          </group>
        ))}

        {/* Spray nozzle */}
        <mesh position={[0, -0.15, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.05, 0.2, 16]} />
          <meshStandardMaterial color={0x27ae60} />
        </mesh>
      </group>

      {/* Spray visualization */}
      <points>
        <primitive object={sprayGeometryRef.current} />
        <pointsMaterial
          size={3}
          color={0x2ecc71}
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>

      {/* Enhanced camera controls */}
      <OrbitControls
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        panSpeed={0.8}
        target={[0, 3, 0]}
      />

      {/* Background stars */}
      <Stars 
        radius={50} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0}
        fade
      />
    </>
  )
}