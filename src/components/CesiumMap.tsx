"use client"

import { useEffect } from 'react'
import { Viewer, CameraFlyTo } from 'resium'
import { Cartesian3, Ion } from 'cesium'
import * as Cesium from 'cesium'

// Import the CSS directly
import "cesium/Build/Cesium/Widgets/widgets.css"

// Initialize Cesium Ion access token
Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ACCESS_TOKEN || '';

if (typeof window !== 'undefined') {
  window.CESIUM_BASE_URL = '/cesium';
}

export default function CesiumMap() {
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