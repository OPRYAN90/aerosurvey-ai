import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS || '{}')),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

async function updateConversionProgress(
  projectId: string,
  progress: number,
  status: 'pending' | 'converting' | 'converted' | 'error' = 'converting'
): Promise<void> {
  await updateDoc(doc(db, 'projects', projectId), {
    conversionStatus: status,
    conversionProgress: progress
  });
}

export async function POST(request: Request) {
  let projectId: string | undefined;
  let tempDir: string | undefined;

  try {
    console.log('API: Received request');

    const authHeader = request.headers.get('authorization');
    console.log('Auth header:', authHeader);

    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }

    if (!process.env.POTREE_CONVERTER_PATH) {
      throw new Error('POTREE_CONVERTER_PATH environment variable is not set');
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      console.log('Token verified for user:', decodedToken.uid);
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new Error('Invalid authentication token');
    }

    const body = await request.json();
    console.log('Request body:', body);

    const { fileUrl, projectId: id } = body;
    projectId = id;

    if (!fileUrl || !projectId) {
      throw new Error('Missing required fields');
    }

    tempDir = path.join(os.tmpdir(), `conversion-${projectId}`);
    const inputPath = path.join(tempDir, 'input.laz');
    const outputPath = path.join(tempDir, 'output');

    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputPath, { recursive: true });

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error('Empty file received');
    }

    await fs.writeFile(inputPath, Buffer.from(buffer));

    await new Promise<void>((resolve, reject) => {
      const converter: ChildProcess = spawn(process.env.POTREE_CONVERTER_PATH!, [
        inputPath,
        '-o', outputPath,
        '--overwrite',
        '--generate-page', 'false'
      ]);

      converter.stdout.on('data', (data) => {
        console.log('Converter output:', data.toString());
      });

      converter.stderr.on('data', (data) => {
        console.error('Converter error:', data.toString());
      });

      converter.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(`Conversion failed with code ${code}`));
      });
    });

    const bucket = getStorage().bucket();
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

    const [url] = await bucket
      .file(`converted/${projectId}/cloud.js`)
      .getSignedUrl({ action: 'read', expires: '03-01-2500' });

    await updateDoc(doc(db, 'projects', projectId), {
      convertedUrl: url,
      conversionStatus: 'converted' as const
    });

    if (!url) {
      throw new Error('No URL generated for converted file');
    }

    return NextResponse.json({ 
      success: true, 
      convertedUrl: url 
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      stack: error.stack,
      projectId
    });

    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    };

    console.log('Sending error response:', errorResponse);

    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
        .catch(err => console.error('Cleanup error:', err));
    }
  }
} 