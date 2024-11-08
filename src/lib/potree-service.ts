import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Project } from '@/types/project';
import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

export class PotreeService {
  static async convertToPointCloud(project: Project) {
    if (!project.fileUrl) {
      throw new Error('No file URL provided');
    }

    try {
      // Update project status
      await updateDoc(doc(db, 'projects', project.id!), {
        processingStatus: 'converting'
      });

      // For now, we'll simulate conversion by just copying the file
      // In a real implementation, you'd need a server component to run PotreeConverter
      console.log('Converting file to Potree format:', project.fileUrl);
      
      // After conversion is complete, update the project
      await updateDoc(doc(db, 'projects', project.id!), {
        processingStatus: 'ready',
        convertedUrl: project.fileUrl // In reality, this would be the converted file URL
      });

      return project.fileUrl;
    } catch (error) {
      console.error('Error converting file:', error);
      await updateDoc(doc(db, 'projects', project.id!), {
        processingStatus: 'error'
      });
      throw error;
    }
  }

  static async loadPointCloud(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to load point cloud data');
    }
    return response.arrayBuffer();
  }
} 