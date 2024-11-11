import { Project } from '@/types/project';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export class ConversionService {
  static async startConversion(project: Project): Promise<void> {
    if (!project.id || !project.fileUrl) {
      throw new Error('Missing required project information');
    }

    console.log('Starting conversion:', {
      projectId: project.id,
      fileUrl: project.fileUrl
    });

    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileUrl: project.fileUrl,
        projectId: project.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Conversion failed:', data);
      throw new Error(data.error || 'Failed to start conversion');
    }

    return data;
  }

  static watchConversionStatus(
    projectId: string,
    onUpdate: (project: Partial<Project>) => void
  ) {
    console.log('Starting conversion watch for:', projectId);
    
    return onSnapshot(
      doc(db, 'projects', projectId),
      (snapshot) => {
        const data = snapshot.data() as Project;
        console.log('Conversion status update:', {
          projectId,
          status: data.conversionStatus,
          progress: data.conversionProgress
        });
        
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