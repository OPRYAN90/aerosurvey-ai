import { Project } from '@/types/project';
import { CoverageAnalysisService } from './coverage-analysis';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

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
      // Start ground segmentation first
      const segmentationResponse = await fetch('/api/ground-segmentation', {
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

      if (!segmentationResponse.ok) {
        const error = await segmentationResponse.json();
        throw new Error(error.message || 'Ground segmentation failed');
      }

      // Analyze coverage area
      if (project.fileUrl) {
        const coverage = await CoverageAnalysisService.analyzeLazFile(project.fileUrl);
        
        // Update project with coverage information
        await updateDoc(doc(db, 'projects', project.id!), {
          coverageArea: coverage
        });
      }

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

      // Log full response info
      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      const contentType = response.headers.get('content-type');
      const text = await response.text();

      // Check if response is HTML (error page)
      if (contentType?.includes('text/html')) {
        console.error('Received HTML response:', text.substring(0, 200));
        throw new Error('Received HTML error page from server');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse response:', {
          error: e,
          text: text.substring(0, 200)
        });
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
      }

      if (!response.ok) {
        console.error('Conversion failed:', data);
        throw new Error(data.error || 'Failed to start conversion');
      }

      return data;
    } catch (error) {
      console.error('Conversion error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        project: {
          id: project.id,
          url: project.fileUrl
        }
      });
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