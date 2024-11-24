import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

function truncateErrorMessage(error: string): string {
  const maxLength = 1000;
  if (error.length <= maxLength) return error;
  return error.substring(0, maxLength) + `... (truncated, full length: ${error.length})`;
}

async function uploadToCloudStorage(projectId: string, data: any, type: string) {
  const bucket = adminStorage.bucket();
  const fileName = `ground-segmentation/${projectId}/${type}.json`;
  const file = bucket.file(fileName);
  
  await file.save(JSON.stringify(data), {
    contentType: 'application/json',
    metadata: {
      projectId,
      type,
      timestamp: new Date().toISOString()
    }
  });

  return fileName;
}

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
      fileUrl: fileUrl?.substring(0, 50) + '...'
    });

    if (!fileUrl || !projectId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: fileUrl or projectId' 
      }, { status: 400 });
    }

    tempDir = path.join(os.tmpdir(), `segmentation-${projectId}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    console.log('Downloading file to:', tempDir);
    const inputPath = path.join(tempDir, 'input.laz');
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(inputPath, buffer);
    console.log('File downloaded successfully');

    await updateSegmentationProgress(projectId, 0, 'processing');

    const scriptPath = path.join(process.cwd(), 'scripts', 'ground_segmentation.py');
    
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
        const chunk = data.toString();
        outputData += chunk;
      });

      pythonProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        console.error('Python script error:', chunk);
        errorData += chunk;
      });

      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      pythonProcess.on('close', (code) => {
        console.log('Python process exited with code:', code);
        if (code === 0) {
          try {
            const trimmedOutput = outputData.trim();
            console.log('Parsing Python output length:', trimmedOutput.length);
            const result = JSON.parse(trimmedOutput);
            
            if (!result.metadata || !result.classification) {
              throw new Error('Invalid output structure from Python script');
            }
            
            resolve(result);
          } catch (e) {
            console.error('Failed to parse Python script output:', e);
            reject(new Error('Invalid output format from Python script'));
          }
        } else {
          const errorMsg = errorData.trim() || 'Unknown error';
          reject(new Error(`Process failed with code ${code}: ${errorMsg}`));
        }
      });
    });

    console.log('Ground segmentation completed, uploading results...');

    // Upload classification data to Cloud Storage
    const classificationPath = await uploadToCloudStorage(projectId, {
      ground: result.classification.ground,
      nonGround: result.classification.nonGround
    }, 'classification');

    // Store only metadata and file references in Firestore
    await adminDb.collection('projects').doc(projectId).update({
      groundSegmentation: {
        metadata: result.metadata,
        hasClassification: true,
        classificationFile: classificationPath,
        updatedAt: new Date().toISOString()
      }
    });

    await updateSegmentationProgress(projectId, 100, 'completed');

    return NextResponse.json({ 
      success: true,
      metadata: result.metadata,
      classificationFile: classificationPath
    });

  } catch (error) {
    console.error('Ground segmentation error:', error);
    
    if (projectId) {
      await updateSegmentationProgress(projectId, 0, 'error');
      await adminDb.collection('projects').doc(projectId).update({
        groundSegmentationError: error instanceof Error 
          ? truncateErrorMessage(error.message)
          : 'Unknown error'
      });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? truncateErrorMessage(error.message) : 'Unknown error'
    }, { status: 500 });

  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
        .catch(console.error);
    }
  }
} 