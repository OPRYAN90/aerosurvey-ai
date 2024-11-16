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

function ConversionProgress({ progress, status }: { progress: number; status?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="w-64 text-center space-y-4">
        <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
        <div className="text-white space-y-1">
          <p className="font-medium">Converting Project</p>
          <p className="text-sm text-white/70">
            {status === 'converting' 
              ? `${Math.round(progress)}% complete`
              : status === 'pending'
              ? 'Preparing conversion...'
              : status === 'error'
              ? 'Conversion failed'
              : 'Processing...'}
          </p>
        </div>
      </div>
    </div>
  );
}

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
        setConversionStatus(projectData.conversionStatus);
        setConversionProgress(projectData.conversionProgress || 0);

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
          setConversionStatus('pending');
          try {
            await ConversionService.startConversion(projectData, (progress) => {
              setConversionProgress(progress);
            });
          } catch (error) {
            setConversionStatus('error');
            setError(error instanceof Error ? error.message : 'Conversion failed');
          }
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
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-blue-900">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-white">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-blue-900">
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
    <main className="h-screen bg-gradient-to-br from-black via-gray-900 to-blue-900">
      {/* Project header */}
      <div className="h-14 border-b border-white/10 bg-black/20">
        <div className="h-full px-6 flex items-center">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        </div>
      </div>

      {/* Viewer Container - Let Potree control the layout */}
      <div className="h-[calc(100vh-3.5rem)] relative">
        {(conversionStatus === 'converting' || conversionStatus === 'pending') && (
          <ConversionProgress 
            progress={conversionProgress} 
            status={conversionStatus}
          />
        )}
        
        {project.convertedUrl && (
          <PotreeViewer 
            project={project}
            onError={setError}
          />
        )}
      </div>
    </main>
  );
}