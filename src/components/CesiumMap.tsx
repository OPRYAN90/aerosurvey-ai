"use client"

import { useEffect, useState } from 'react'
import { Viewer, CameraFlyTo, Entity } from 'resium'
import { Cartesian3, Ion, Color, Rectangle } from 'cesium'
import * as Cesium from 'cesium'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { Project } from '@/types/project'

// Import the CSS directly
import "cesium/Build/Cesium/Widgets/widgets.css"

// Initialize Cesium Ion access token
Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ACCESS_TOKEN || '';

if (typeof window !== 'undefined') {
  window.CESIUM_BASE_URL = '/cesium';
}

interface CoveragePolygon {
  id: string;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  center?: {
    longitude: number;
    latitude: number;
  };
}

export default function CesiumMap() {
  const [coverageAreas, setCoverageAreas] = useState<CoveragePolygon[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to projects with coverage areas
    const projectsQuery = query(collection(db, 'projects'));
    
    const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
      const areas: CoveragePolygon[] = [];
      
      snapshot.forEach((doc) => {
        const project = doc.data() as Project;
        if (project.coverageArea?.bounds) {
          areas.push({
            id: doc.id,
            bounds: {
              west: project.coverageArea.bounds.minX,
              south: project.coverageArea.bounds.minY,
              east: project.coverageArea.bounds.maxX,
              north: project.coverageArea.bounds.maxY
            },
            center: project.coverageArea.center
          });
        }
      });
      
      setCoverageAreas(areas);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Viewer
      full
      timeline={false}
      animation={false}
      baseLayerPicker={true}
      navigationHelpButton={true}
      homeButton={true}
      geocoder={true}
      sceneModePicker={true}
      className="w-full h-full"
      scene3DOnly={false}
      selectionIndicator={true}
      infoBox={true}
      navigationInstructionsInitiallyVisible={false}
    >
      <CameraFlyTo
        duration={0}
        destination={Cartesian3.fromDegrees(-98.35, 39.50, 5000000)}
      />
      
      {coverageAreas.map((area) => (
        <Entity
          key={area.id}
          rectangle={{
            coordinates: Rectangle.fromDegrees(
              area.bounds.west,
              area.bounds.south,
              area.bounds.east,
              area.bounds.north
            ),
            material: new Color(0.0, 1.0, 0.0, 0.2),
            outline: true,
            outlineColor: Color.GREEN,
            outlineWidth: 2,
          }}
          onClick={() => setSelectedArea(area.id)}
        />
      ))}
    </Viewer>
  );
} 