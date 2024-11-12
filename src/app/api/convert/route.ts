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

    // Auth check and request data parsing
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    console.log('Auth verified for user:', decodedToken.uid);

    const { fileUrl, projectId: id } = await request.json();
    projectId = id;

    if (!fileUrl || !projectId) {
      throw new Error('Missing required fields: fileUrl or projectId');
    }

    // Create temp directories with new structure
    tempDir = path.join(os.tmpdir(), `conversion-${projectId}`);
    const baseOutputPath = path.join(tempDir, 'output');
    const pointcloudsPath = path.join(baseOutputPath, 'pointclouds');
    const inputPath = path.join(tempDir, 'input.laz');

    console.log('Directory setup:', {
      baseOutputPath,
      pointcloudsPath,
      converterPath: process.env.POTREE_CONVERTER_PATH
    });

    // Create directories
    await fs.mkdir(baseOutputPath, { recursive: true });
    await fs.mkdir(pointcloudsPath, { recursive: true });

    // Download file
    console.log('Downloading file:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    // Update progress
    await updateConversionProgress(projectId, 20);

    // Run conversion
    console.log('Running PotreeConverter with paths:', {
      input: inputPath,
      output: baseOutputPath
    });

    await new Promise<void>((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';

      converter = spawn(process.env.POTREE_CONVERTER_PATH!, [
        inputPath,
        '-o', baseOutputPath,
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

    // Verify converted files
    const potreeOutputPath = path.join(pointcloudsPath, projectId);
    const requiredFiles = ['metadata.json', 'hierarchy.bin', 'octree.bin'];
    console.log('Verifying converted files...');
    
    for (const file of requiredFiles) {
      const filePath = path.join(potreeOutputPath, file);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      console.log(`File ${file}: ${exists ? 'Found' : 'Missing'}`);
      if (!exists) throw new Error(`Required file ${file} not found after conversion`);
    }

    // Upload files
    const bucket = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    console.log('Uploading converted files to Firebase');
    await updateConversionProgress(projectId, 60);

    for (const file of requiredFiles) {
      const filePath = path.join(potreeOutputPath, file);
      const destination = `converted/${projectId}/${file}`;
      
      console.log(`Uploading ${file} to ${destination}`);
      
      await bucket.upload(filePath, {
        destination,
        metadata: {
          contentType: file.endsWith('.json') ? 
                      'application/json' : 'application/octet-stream'
        }
      });
    }

    // Get metadata.json URL
    const [url] = await bucket
      .file(`converted/${projectId}/metadata.json`)
      .getSignedUrl({
        action: 'read',
        expires: '03-01-2500'
      });

    await updateConversionProgress(projectId, 100, 'converted');
    await adminDb.collection('projects').doc(projectId).update({
      convertedUrl: url
    });

    return NextResponse.json({ success: true, convertedUrl: url });

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