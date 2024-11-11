import { Project } from '@/types/project';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export class ConversionService {
  static async startConversion(project: Project, authToken: string): Promise<void> {
    if (!project.id || !project.fileUrl) {
      throw new Error('Missing required project information');
    }

    console.log('Starting conversion:', {
      projectId: project.id,
      fileUrl: project.fileUrl
    });

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fileUrl: project.fileUrl,
          projectId: project.id
        })
      });

      // Log the raw response
      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Get response text first
      const text = await response.text();
      console.log('Response text:', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error(`Invalid response from server: ${text}`);
      }

      if (!response.ok) {
        console.error('Conversion failed:', data);
        throw new Error(data.error || 'Failed to start conversion');
      }

      return data;
    } catch (error) {
      console.error('Conversion error:', error);
      throw error;
    }
  }

  static watchConversionStatus(
    projectId: string,
    onUpdate: (project: Partial<Project>) => void
  ) {
    return onSnapshot(
      doc(db, 'projects', projectId),
      (snapshot) => {
        const data = snapshot.data() as Project;
        onUpdate({
          conversionStatus: data.conversionStatus,
          conversionProgress: data.conversionProgress,
          convertedUrl: data.convertedUrl,
          conversionError: data.conversionError
        });
      },
      (error) => {
        console.error('Error watching conversion:', error);
        onUpdate({
          conversionStatus: 'error',
          conversionError: error.message
        });
      }
    );
  }
} 