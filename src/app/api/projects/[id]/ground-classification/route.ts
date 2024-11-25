import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }  // Changed from projectId to id to match folder name
) {
  const projectId = params.id;  // Get ID from params.id instead of params.projectId
  console.log('🔍 API: Starting request for project:', projectId);

  try {
    if (!projectId) {
      console.log('❌ API: Missing project ID');
      return NextResponse.json({ 
        success: false, 
        error: 'Project ID is required' 
      }, { status: 400 });
    }

    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ API: Missing auth header');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(token);
    console.log('✅ API: Auth verified');

    // Get project data with explicit path
    const projectRef = adminDb.collection('projects').doc(projectId);
    console.log('📄 API: Accessing document at path:', projectRef.path);
    
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      console.log('❌ API: Project not found:', projectId);
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found' 
      }, { status: 404 });
    }

    const project = projectDoc.data();
    console.log('📄 API: Project data:', {
      id: projectId,
      hasGroundSegmentation: !!project?.groundSegmentation,
      classificationPath: project?.groundSegmentation?.classificationFile
    });

    if (!project?.groundSegmentation?.classificationFile) {
      console.log('❌ API: No ground segmentation data found');
      return NextResponse.json({ 
        success: false, 
        error: 'Ground segmentation not processed' 
      }, { status: 404 });
    }

    // Get classification data from storage
    const bucket = adminStorage.bucket();
    const file = bucket.file(project.groundSegmentation.classificationFile);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.log('❌ API: Classification file not found in storage');
      return NextResponse.json({ 
        success: false, 
        error: 'Classification data not found' 
      }, { status: 404 });
    }

    const [content] = await file.download();
    const classification = JSON.parse(content.toString());

    console.log('✅ API: Retrieved classification data:', {
      groundPoints: classification.ground?.length || 0,
      nonGroundPoints: classification.nonGround?.length || 0
    });

    return NextResponse.json({
      success: true,
      metadata: project.groundSegmentation.metadata,
      classification
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}