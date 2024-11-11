'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Project } from '@/types/project';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ConversionService } from '@/lib/conversion-service';

const PotreeViewer = dynamic(
  () => import('@/components/PotreeViewer'),
  { ssr: false }
);

export default function VisualizePage() {
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversionStatus, setConversionStatus] = useState<Project['conversionStatus']>();
  const [conversionProgress, setConversionProgress] = useState<number>(0);

  useEffect(() => {
    const loadProject = async () => {
      if (!params.id) return;

      try {
        const projectDoc = await getDoc(doc(db, 'projects', params.id as string));
        
        if (!projectDoc.exists()) {
          throw new Error('Project not found');
        }

        const projectData = { id: projectDoc.id, ...projectDoc.data() } as Project;
        setProject(projectData);

        const unsubscribe = ConversionService.watchConversionStatus(
          projectData.id!,
          (updates) => {
            setConversionStatus(updates.conversionStatus);
            setConversionProgress(updates.conversionProgress || 0);
            
            if (updates.convertedUrl) {
              setProject(prev => prev ? { ...prev, convertedUrl: updates.convertedUrl } : null);
            }
            
            if (updates.conversionError) {
              setError(updates.conversionError);
            }
          }
        );

        if (projectData.fileUrl && !projectData.convertedUrl && projectData.conversionStatus !== 'converting') {
          await ConversionService.startConversion(projectData);
        }

        return unsubscribe;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-white">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">!</span>
          </div>
          <h3 className="text-red-500 font-semibold">Error Loading Project</h3>
          <p className="text-white/70">{error || 'Project not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900 pt-14">
      <div className="p-5">
        <h1 className="text-2xl font-bold text-white mb-4">{project.name}</h1>
        <div className="bg-black/40 rounded-lg overflow-hidden h-[calc(100vh-12rem)]">
          <PotreeViewer 
            project={project}
            onError={setError}
          />
        </div>
      </div>
    </div>
  );
}
