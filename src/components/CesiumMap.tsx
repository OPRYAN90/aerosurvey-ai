"use client"

import { useEffect } from 'react'
import { Viewer, Entity } from 'resium'
import { Cartesian3, Color } from 'cesium'
import * as Cesium from 'cesium'

// Import the CSS directly
import "cesium/Build/Cesium/Widgets/widgets.css"

// Initialize Cesium Ion access token
Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ACCESS_TOKEN || '';

// Add this type declaration at the top of the file
declare global {
  interface Window {
    CESIUM_BASE_URL: string;
  }
}

export default function CesiumMap() {
  useEffect(() => {
    // Configure the default Cesium assets location
    window.CESIUM_BASE_URL = '/static/cesium';
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