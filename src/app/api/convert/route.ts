import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

async function updateConversionProgress(
  projectId: string, 
  progress: number, 
  status: string = 'converting'
) {
  await updateDoc(doc(db, 'projects', projectId), {
    conversionStatus: status,
    conversionProgress: progress
  });
}

export async function POST(request: Request) {
  let projectId: string | undefined;
  
  try {
    const { fileUrl, projectId: id } = await request.json();
    projectId = id;

    // Start conversion
    await updateConversionProgress(projectId, 0);

    // Download original file
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();

    await updateConversionProgress(projectId, 20);

    // Create the Potree octree structure
    const octreeDir = `converted/${projectId}/cloud.js`;
    
    // Simulate conversion steps (replace with actual conversion later)
    await new Promise(resolve => setTimeout(resolve, 1000));
    await updateConversionProgress(projectId, 40);

    await new Promise(resolve => setTimeout(resolve, 1000));
    await updateConversionProgress(projectId, 60);

    // Upload converted file
    const mainFileRef = ref(storage, octreeDir);
    await uploadBytes(mainFileRef, buffer, {
      contentType: 'application/octet-stream'
    });

    await updateConversionProgress(projectId, 80);

    // Get URL for the converted file
    const convertedUrl = await getDownloadURL(mainFileRef);

    // Update project with success
    await updateConversionProgress(projectId, 100, 'converted');
    await updateDoc(doc(db, 'projects', projectId), {
      convertedUrl
    });

    return NextResponse.json({ 
      success: true, 
      convertedUrl 
    });

  } catch (error) {
    console.error('Conversion error:', error);
    
    if (projectId) {
      await updateDoc(doc(db, 'projects', projectId), {
        conversionStatus: 'error',
        conversionError: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json(
      { error: 'Conversion failed' },
      { status: 500 }
    );
  }
} 