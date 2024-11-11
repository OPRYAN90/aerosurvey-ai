import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function updateConversionProgress(
  projectId: string,
  progress: number,
  status: string = 'converting'
) {
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      conversionStatus: status,
      conversionProgress: progress
    });
  } catch (error) {
    console.error('Error updating progress:', error);
  }
}

export async function POST(request: Request) {
  let projectId: string | undefined;
  
  try {
    console.log('API: Received conversion request');
    const body = await request.json();
    console.log('API: Request body:', body);

    const { fileUrl, projectId: id } = body;
    projectId = id;

    if (!fileUrl || !projectId) {
      console.error('API: Missing required fields:', { fileUrl, projectId });
      throw new Error('Missing required fields: fileUrl or projectId');
    }

    console.log('API: Starting conversion for project:', {
      projectId,
      fileUrl
    });

    await updateConversionProgress(projectId, 0);
    
    console.log('API: Downloading file from:', fileUrl);
    const response = await fetch(fileUrl);
    
    console.log('API: Download response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    console.log('API: File downloaded successfully, size:', buffer.byteLength);

    await updateConversionProgress(projectId, 20);

    const octreeDir = `converted/${projectId}/cloud.js`;
    console.log('API: Creating octree at:', octreeDir);

    console.log('API: Uploading to Firebase Storage:', octreeDir);
    const mainFileRef = ref(storage, octreeDir);
    await uploadBytes(mainFileRef, buffer, {
      contentType: 'application/octet-stream'
    });

    console.log('API: File uploaded successfully');
    await updateConversionProgress(projectId, 80);

    console.log('API: Getting download URL');
    const convertedUrl = await getDownloadURL(mainFileRef);
    console.log('API: Generated download URL:', convertedUrl);

    await updateConversionProgress(projectId, 100, 'converted');
    await updateDoc(doc(db, 'projects', projectId), {
      convertedUrl,
      conversionStatus: 'converted'
    });

    console.log('API: Conversion completed successfully');
    return NextResponse.json({ 
      success: true, 
      convertedUrl 
    });

  } catch (error) {
    console.error('API: Conversion error:', {
      error,
      projectId,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (projectId) {
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          conversionStatus: 'error',
          conversionError: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (updateError) {
        console.error('API: Error updating project status:', updateError);
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 