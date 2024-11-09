import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { fileUrl, projectId } = await request.json();

    // Update status to converting
    await updateDoc(doc(db, 'projects', projectId), {
      conversionStatus: 'converting',
      conversionProgress: 0
    });

    // Download original file
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();

    // For now, we'll just store the file in a different location
    // Later we'll add actual conversion
    const convertedRef = ref(
      storage,
      `converted/${projectId}/pointcloud/cloud.js`
    );

    await uploadBytes(convertedRef, buffer, {
      contentType: 'application/octet-stream'
    });

    const convertedUrl = await getDownloadURL(convertedRef);

    // Update project with success
    await updateDoc(doc(db, 'projects', projectId), {
      conversionStatus: 'converted',
      convertedUrl,
      conversionProgress: 100
    });

    return NextResponse.json({ 
      success: true, 
      convertedUrl 
    });
  } catch (error) {
    console.error('Conversion error:', error);
    
    // Update project with error if we have projectId
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