"use client"

import { useEffect } from 'react'
import { Viewer, CameraFlyTo } from 'resium'
import { Cartesian3 } from 'cesium'
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
    </Viewer>
  );
} 