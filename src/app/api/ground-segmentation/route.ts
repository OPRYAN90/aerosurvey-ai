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
      throw new Error('Invalid authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(token);

    const { fileUrl, projectId: id } = await request.json();
    projectId = id;

    if (!fileUrl || !projectId) {
      throw new Error('Missing required fields');
    }

    // Create temp directory
    tempDir = path.join(os.tmpdir(), `segmentation-${projectId}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Download file
    const inputPath = path.join(tempDir, 'input.laz');
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    // Update initial status
    await updateSegmentationProgress(projectId, 0, 'processing');

    // Run Python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'ground_segmentation.py');
    
    const result = await new Promise<any>((resolve, reject) => {
      const process = spawn('python', [scriptPath, inputPath]);
      let outputData = '';
      let errorData = '';

      process.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      process.on('error', reject);

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(outputData);
            resolve(result);
          } catch (e) {
            reject(new Error(`Invalid output: ${outputData}`));
          }
        } else {
          reject(new Error(`Script failed: ${errorData}`));
        }
      });
    });

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
    console.error('Segmentation error:', error);
    
    if (projectId) {
      await updateSegmentationProgress(projectId, 0, 'error');
      await adminDb.collection('projects').doc(projectId).update({
        groundSegmentationError: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });

  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
        .catch(console.error);
    }
  }
} 