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
    console.log('API: Starting conversion request');

    // Add logging for the environment
    console.log('Environment check:', {
      tempDir: os.tmpdir(),
      converterPath: process.env.POTREE_CONVERTER_PATH,
      cwd: process.cwd()
    });

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

    // Create temp directories
    tempDir = path.join(os.tmpdir(), `conversion-${projectId}`);
    const inputPath = path.join(tempDir, 'input.laz');
    const outputPath = path.join(tempDir, 'output');

    // Ensure directories exist
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputPath, { recursive: true });

    // Download file with better error handling
    console.log('Downloading file:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    // Verify file was written
    const stats = await fs.stat(inputPath);
    console.log('Input file stats:', {
      size: stats.size,
      path: inputPath,
      isFile: stats.isFile()
    });

    // Update initial status
    await updateConversionProgress(projectId, 0);

    // Run conversion
    console.log('Starting PotreeConverter');
    await new Promise<void>((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';

      converter = spawn(process.env.POTREE_CONVERTER_PATH, [
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

    // Upload converted files with verification
    console.log('Uploading converted files');
    const files = await fs.readdir(outputPath);

    for (const file of files) {
      const filePath = path.join(outputPath, file);
      const fileStats = await fs.stat(filePath);
      
      if (fileStats.isFile()) {  // Only upload files, not directories
        await bucket.upload(filePath, {
          destination: `converted/${projectId}/${file}`,
          metadata: {
            contentType: 'application/octet-stream'
          }
        });
      }
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

  } catch (error) {
    console.error('Conversion error:', {
      error,
      tempDir,
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