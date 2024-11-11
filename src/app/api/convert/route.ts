import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { adminStorage, adminDb } from '@/lib/firebase-admin';

async function updateConversionProgress(
  projectId: string,
  progress: number,
  status: 'pending' | 'converting' | 'converted' | 'error' = 'converting'
) {
  try {
    await adminDb.collection('projects').doc(projectId).update({
      conversionStatus: status,
      conversionProgress: progress
    });
  } catch (error) {
    console.error('Error updating progress:', error);
  }
}

export const runtime = 'nodejs' // Force Node.js runtime

export async function POST(request: Request) {
  let projectId: string | undefined;
  let tempDir: string | undefined;
  let converter: ChildProcess | undefined;

  try {
    // Validate admin is initialized
    console.log('Route handler starting');
    
    // Check Firebase Admin initialization
    if (!adminStorage || !adminDb) {
      console.error('Firebase Admin not initialized');
      throw new Error('Internal server configuration error');
    }

    // Log environment state
    console.log('Environment check:', {
      hasStorage: !!adminStorage,
      bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      converterPath: process.env.POTREE_CONVERTER_PATH
    });

    console.log('API: Starting conversion request');

    // Verify storage
    const bucket = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    console.log('Storage initialization check:', {
      bucketName: bucket.name,
      exists: await bucket.exists().then(([exists]) => exists)
    });

    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    console.log('Auth verified for user:', decodedToken.uid);

    // Get request data
    const { fileUrl, projectId: id } = await request.json();
    projectId = id;

    if (!fileUrl || !projectId) {
      throw new Error('Missing required fields: fileUrl or projectId');
    }

    // Verify PotreeConverter
    const converterPath = process.env.POTREE_CONVERTER_PATH;
    if (!converterPath) {
      throw new Error('POTREE_CONVERTER_PATH not configured');
    }

    await fs.access(converterPath)
      .catch(() => {
        throw new Error('PotreeConverter not found at: ' + converterPath);
      });

    // Create temp directories
    tempDir = path.join(os.tmpdir(), `conversion-${projectId}`);
    const inputPath = path.join(tempDir, 'input.laz');
    const outputPath = path.join(tempDir, 'output');

    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputPath, { recursive: true });

    // Update initial status
    await updateConversionProgress(projectId, 0);

    // Download file
    console.log('Downloading file from:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(inputPath, Buffer.from(buffer));
    await updateConversionProgress(projectId, 20);

    // Run conversion
    console.log('Starting PotreeConverter');
    await new Promise<void>((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';

      converter = spawn(converterPath, [
        inputPath,
        '-o', outputPath,
        '--overwrite',
        '--generate-page', 'false'
      ], {
        windowsHide: true,
        env: process.env
      });

      converter.stdout?.on('data', (data) => {
        stdoutData += data.toString();
        console.log('Converter output:', data.toString());
      });

      converter.stderr?.on('data', (data) => {
        stderrData += data.toString();
        console.error('Converter error:', data.toString());
      });

      converter.on('error', (error) => {
        console.error('Spawn error:', error);
        reject(new Error(`Failed to start converter: ${error.message}`));
      });

      converter.on('close', (code: number | null, signal: string | null) => {
        if (code === 0) {
          console.log('Conversion completed successfully');
          resolve();
        } else {
          reject(new Error(
            `Conversion failed with code ${code}. ` +
            `Signal: ${signal}. ` +
            `Stdout: ${stdoutData}. ` +
            `Stderr: ${stderrData}`
          ));
        }
      });
    });

    await updateConversionProgress(projectId, 60);

    // Upload converted files
    console.log('Uploading converted files');
    const files = await fs.readdir(outputPath);

    for (const file of files) {
      const filePath = path.join(outputPath, file);
      await bucket.upload(filePath, {
        destination: `converted/${projectId}/${file}`,
        metadata: {
          contentType: 'application/octet-stream'
        }
      });
    }

    await updateConversionProgress(projectId, 80);

    // Get signed URL
    const [url] = await bucket
      .file(`converted/${projectId}/cloud.js`)
      .getSignedUrl({
        action: 'read',
        expires: '03-01-2500'
      });

    // Update final status
    await updateConversionProgress(projectId, 100, 'converted');
    await adminDb.collection('projects').doc(projectId).update({
      convertedUrl: url
    });

    console.log('Conversion process completed successfully');
    return NextResponse.json({
      success: true,
      convertedUrl: url
    });

  } catch (error: unknown) {
    console.error('Conversion failed:', {
      error,
      projectId,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    if (projectId) {
      await updateConversionProgress(
        projectId,
        0,
        'error'
      );
      await adminDb.collection('projects').doc(projectId).update({
        conversionError: error instanceof Error ? error.message : 'Unknown error'
      }).catch(err => console.error('Failed to update error status:', err));
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { 
      status: 500 
    });

  } finally {
    // Cleanup
    if (converter && !converter.killed) {
      try {
        converter.kill();
      } catch (err) {
        console.error('Error killing converter process:', err);
      }
    }

    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error cleaning up temp directory:', err);
      }
    }
  }
}