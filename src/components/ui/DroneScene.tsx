"use client"

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

export function DroneScene({ isAnimating }: { isAnimating: boolean }) {
  const droneGroup = useRef<THREE.Group>(null)
  const rotorsRef = useRef<THREE.Mesh[]>([])
  const scanPointsRef = useRef<number[]>([])
  const scanGeometryRef = useRef(new THREE.BufferGeometry())
  const frame = useRef(0)

  useFrame(() => {
    if (!isAnimating || !droneGroup.current) return

    frame.current++
    
    // Drone movement
    droneGroup.current.position.z = Math.sin(frame.current * 0.02) * 5
    droneGroup.current.rotation.y = Math.sin(frame.current * 0.01) * 0.1
    
    // Rotor rotation
    rotorsRef.current.forEach((rotor, i) => {
      if (rotor) {
        rotor.rotation.y = frame.current * (i % 2 ? 0.5 : -0.5)
      }
    })
    
    // LiDAR scan effect
    if (frame.current % 5 === 0) {
      const scanX = droneGroup.current.position.x + (Math.random() - 0.5) * 4
      const scanZ = droneGroup.current.position.z + (Math.random() - 0.5) * 4
      scanPointsRef.current.push(scanX, 0, scanZ)
      
      if (scanPointsRef.current.length > 3000) {
        scanPointsRef.current.splice(0, 3)
      }
      
      scanGeometryRef.current.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(scanPointsRef.current, 3)
      )
    }
  })

  return (
    <>
      <fog attach="fog" args={[0x000000, 10, 50]} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[20, 100, 20, 100]} />
        <meshStandardMaterial color={0x333333} roughness={0.8} metalness={0.2} />
      </mesh>
      
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <boxGeometry args={[0.2, 20, 0.01]} />
        <meshBasicMaterial color={0xffffff} />
      </mesh>
      
      <group ref={droneGroup} position={[0, 4, 0]}>
        <mesh>
          <boxGeometry args={[1, 0.2, 1]} />
          <meshPhongMaterial color={0x2c3e50} />
        </mesh>
        
        {[[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]].map((pos, i) => (
          <mesh key={i} position={[pos[0], 0, pos[1]]}>
            <boxGeometry args={[0.1, 0.1, 1.2]} />
            <meshPhongMaterial color={0x2c3e50} />
          </mesh>
        ))}
        
        {[[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]].map((pos, i) => (
          <mesh
            key={`rotor-${i}`}
            ref={(el: THREE.Mesh | null) => {
              if (el) rotorsRef.current[i] = el
            }}
            position={[pos[0], 0.1, pos[1]]}
          >
            <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
            <meshPhongMaterial color={0x95a5a6} />
          </mesh>
        ))}
      </group>
      
      <points>
        <primitive object={scanGeometryRef.current} />
        <pointsMaterial size={0.05} color={0x00ff00} transparent opacity={0.6} />
      </points>
      
      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  )
}