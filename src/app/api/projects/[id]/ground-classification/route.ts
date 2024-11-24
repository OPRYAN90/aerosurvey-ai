import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    console.log('Handling ground classification request for project:', projectId);

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Verify Firebase token
    const token = authHeader.split('Bearer ')[1];
    try {
      await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Invalid token:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid authorization token' 
      }, { status: 401 });
    }

    // Get project document
    console.log('Fetching project data...');
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
    if (!project) {
      throw new Error('Project data is empty');
    }

    // For testing purposes, generate random classification
    // Remove this in production and replace with actual ground segmentation data
    console.log('Generating test classification data...');
    const numPoints = 1000; // Adjust based on your needs
    const groundPoints = Array.from({ length: numPoints }, 
      (_, i) => Math.random() > 0.5 ? i : null)
      .filter((x): x is number => x !== null);

    const nonGroundPoints = Array.from({ length: numPoints }, 
      (_, i) => !groundPoints.includes(i) ? i : null)
      .filter((x): x is number => x !== null);

    console.log('Classification data generated:', {
      groundPoints: groundPoints.length,
      nonGroundPoints: nonGroundPoints.length
    });

    // Return mock classification data
    return NextResponse.json({
      success: true,
      metadata: {
        totalPoints: numPoints,
        groundPoints: groundPoints.length,
        nonGroundPoints: nonGroundPoints.length,
        timestamp: new Date().toISOString()
      },
      classification: {
        ground: groundPoints,
        nonGround: nonGroundPoints
      }
    });

  } catch (error) {
    console.error('Error in ground classification endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}