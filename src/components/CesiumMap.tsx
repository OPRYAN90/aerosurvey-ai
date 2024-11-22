"use client"

import { useEffect } from 'react'
import { Viewer, Entity } from 'resium'
import { Cartesian3, Color } from 'cesium'
import * as Cesium from 'cesium'

// Import the CSS directly
import "cesium/Build/Cesium/Widgets/widgets.css"

// Initialize Cesium Ion access token
Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ACCESS_TOKEN || '';

declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}

export default function CesiumMap() {
  useEffect(() => {
    // Update the base URL to point to the public directory
    window.CESIUM_BASE_URL = '/cesium';
  }, []);

  return (
    <Viewer
      full
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      className="w-full h-full"
    >
      <Entity
        position={Cartesian3.fromDegrees(-74.0060, 40.7128, 1000)}
        point={{ pixelSize: 10, color: Color.RED }}
        description="Sample Point"
      />
    </Viewer>
  );
} 