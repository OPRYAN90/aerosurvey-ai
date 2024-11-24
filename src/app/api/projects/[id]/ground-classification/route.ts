import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  console.log('Fetching ground classification for project:', projectId);

  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(token);

    // Get project data
    const projectDoc = await adminDb
      .collection('projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists) {
      console.error('Project not found:', projectId);
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found' 
      }, { status: 404 });
    }

    const project = projectDoc.data();
    
    // Verify ground segmentation exists
    if (!project?.groundSegmentation?.hasClassification) {
      console.error('No ground segmentation found for project:', projectId);
      return NextResponse.json({ 
        success: false, 
        error: 'Ground segmentation not found' 
      }, { status: 404 });
    }

    console.log('Fetching classification data from storage...');

    // Get classification file from Cloud Storage
    const bucket = adminStorage.bucket();
    const classificationFile = bucket
      .file(`ground-segmentation/${projectId}/classification.json`);

    const [exists] = await classificationFile.exists();
    if (!exists) {
      console.error('Classification file not found in storage');
      return NextResponse.json({ 
        success: false, 
        error: 'Classification data not found' 
      }, { status: 404 });
    }

    // Get classification data
    const [fileContent] = await classificationFile.download();
    const classification = JSON.parse(fileContent.toString());

    console.log('Successfully retrieved classification data', {
      groundPoints: classification.ground.length,
      nonGroundPoints: classification.nonGround.length
    });

    return NextResponse.json({
      success: true,
      metadata: project.groundSegmentation.metadata,
      classification: {
        ground: classification.ground,
        nonGround: classification.nonGround
      }
    });

  } catch (error) {
    console.error('Error fetching ground classification:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}