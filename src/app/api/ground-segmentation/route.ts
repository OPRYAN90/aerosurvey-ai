import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { adminDb } from '@/lib/firebase-admin';

async function updateSegmentationProgress(
  projectId: string,
  progress: number,
  status: 'pending' | 'processing' | 'completed' | 'error' = 'processing'
) {
  try {
    await adminDb.collection('projects').doc(projectId).update({
      groundSegmentationStatus: status,
      groundSegmentationProgress: progress
    });
  } catch (error) {
    console.error('Error updating segmentation progress:', error);
  }
}

export async function POST(request: Request) {
  let projectId: string | undefined;
  let tempDir: string | undefined;

  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid authorization header' 
      }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(token);

    const body = await request.json();
    const { fileUrl, projectId: id } = body;
    projectId = id;

    console.log('Starting ground segmentation for project:', {
      projectId,
      fileUrl: fileUrl?.substring(0, 50) + '...' // Log truncated URL for privacy
    });

    if (!fileUrl || !projectId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: fileUrl or projectId' 
      }, { status: 400 });
    }

    // Create temp directory
    tempDir = path.join(os.tmpdir(), `segmentation-${projectId}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Download file
    console.log('Downloading file to:', tempDir);
    const inputPath = path.join(tempDir, 'input.laz');
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(inputPath, buffer);
    console.log('File downloaded successfully');

    // Update initial status
    await updateSegmentationProgress(projectId, 0, 'processing');

    // Run Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'ground_segmentation.py');
    
    // Check if script exists
    try {
      await fs.access(scriptPath);
    } catch (error) {
      console.error('Python script not found at:', scriptPath);
      throw new Error('Ground segmentation script not found');
    }

    console.log('Running ground segmentation script:', scriptPath);
    
    const result = await new Promise<any>((resolve, reject) => {
      const pythonProcess = spawn('python', [scriptPath, inputPath]);
      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
        console.log('Python script output:', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        console.error('Python script error:', data.toString());
      });

      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        reject(error);
      });

      pythonProcess.on('close', (code) => {
        console.log('Python process exited with code:', code);
        if (code === 0) {
          try {
            const result = JSON.parse(outputData);
            resolve(result);
          } catch (e) {
            console.error('Failed to parse Python script output:', e);
            reject(new Error(`Invalid output from Python script: ${outputData}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${errorData}`));
        }
      });
    });

    console.log('Ground segmentation completed successfully');

    // Store results in Firestore
    await adminDb.collection('projects').doc(projectId).update({
      groundSegmentation: {
        metadata: result.metadata,
        hasClassification: true
      }
    });

    // Store classification data in chunks
    const chunkSize = 10000;
    const { ground, nonGround } = result.classification;

    for (let i = 0; i < ground.length; i += chunkSize) {
      await adminDb
        .collection('projects')
        .doc(projectId)
        .collection('groundClassification')
        .doc(`chunk_${i}`)
        .set({
          ground: ground.slice(i, i + chunkSize),
          nonGround: nonGround.slice(i, i + chunkSize)
        });
    }

    await updateSegmentationProgress(projectId, 100, 'completed');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Ground segmentation error:', error);
    
    if (projectId) {
      await updateSegmentationProgress(projectId, 0, 'error');
      await adminDb.collection('projects').doc(projectId).update({
        groundSegmentationError: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });

  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
        .catch(console.error);
    }
  }
} 