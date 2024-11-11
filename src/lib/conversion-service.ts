import { Project } from '@/types/project';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export class ConversionService {
  static async startConversion(project: Project): Promise<void> {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileUrl: project.fileUrl,
        projectId: project.id
      })
    });

    if (!response.ok) {
      throw new Error('Failed to start conversion');
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
      }
    );
  }
} 