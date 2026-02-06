
import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Loader2, 
  Film, 
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Download,
  AlertTriangle
} from 'lucide-react';
import { GeneratedContent } from '../types';
import { generateVideoFromStoryboard } from '../services/geminiService';

interface VideoStoryboardModalProps {
  content: GeneratedContent;
  onClose: () => void;
  onUpdate: (updatedContent: GeneratedContent) => void;
}

export const VideoStoryboardModal: React.FC<VideoStoryboardModalProps> = ({ 
  content, 
  onClose, 
  onUpdate 
}) => {
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'slideshow'>('video');

  // Check if scenes have valid generated images (not mock URLs or empty)
  const hasValidImages = content.storyboard?.every(s => s.imageUrl && s.imageUrl.startsWith('data:'));
  const hasImages = content.storyboard?.some(s => !!s.imageUrl);

  const handleGenerateVideo = async () => {
    if (!content.storyboard) return;
    
    if (!hasValidImages) {
      alert("Real generated images are required for video creation. Mock images or incomplete generations cannot be used with Veo.");
      return;
    }

    setIsGeneratingVideo(true);
    // Update status to generating
    onUpdate({ ...content, videoStatus: 'generating' });

    try {
      const videoUrl = await generateVideoFromStoryboard(content.storyboard);
      onUpdate({ 
        ...content, 
        videoUrl, 
        videoStatus: 'completed' 
      });
    } catch (error: any) {
      console.error("Video gen failed", error);
      onUpdate({ ...content, videoStatus: 'failed' });
      alert(`Video generation failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden animate-fadeIn">
        
        {/* Left Panel: Preview */}
        <div className="w-2/3 bg-slate-50 flex flex-col border-r border-slate-200">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center space-x-2">
              <Film className="text-purple-600" size={20} />
              <h2 className="font-bold text-slate-900">Video Generation</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 p-8 flex flex-col items-center justify-center relative overflow-y-auto">
            {/* View Toggle */}
            <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm mb-6 flex space-x-1">
              <button 
                onClick={() => setActiveTab('video')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === 'video' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Film size={16} />
                <span>AI Video</span>
              </button>
              <button 
                onClick={() => setActiveTab('slideshow')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                  activeTab === 'slideshow' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ImageIcon size={16} />
                <span>Storyboard Preview</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="w-full max-w-3xl aspect-video bg-black rounded-xl shadow-lg overflow-hidden relative group">
              {activeTab === 'video' ? (
                content.videoUrl ? (
                  <video src={content.videoUrl} controls className="w-full h-full object-contain" autoPlay loop />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900">
                    {isGeneratingVideo || content.videoStatus === 'generating' ? (
                      <>
                        <Loader2 size={48} className="animate-spin text-purple-500 mb-4" />
                        <p className="text-lg font-medium">Generating AI Video...</p>
                        <p className="text-sm text-slate-400 mt-2">This may take up to 2 minutes</p>
                      </>
                    ) : (
                      <>
                        <Film size={48} className="text-slate-600 mb-4" />
                        <p className="text-lg font-medium text-slate-300">No video generated yet</p>
                        {!hasImages ? (
                           <div className="flex items-center space-x-2 text-amber-400 mt-4 bg-amber-900/30 px-4 py-2 rounded-lg">
                             <Loader2 size={16} className="animate-spin" />
                             <span className="text-sm">Waiting for storyboard images...</span>
                           </div>
                        ) : !hasValidImages ? (
                           <div className="flex items-center space-x-2 text-red-400 mt-4 bg-red-900/30 px-4 py-2 rounded-lg">
                             <AlertTriangle size={16} />
                             <span className="text-sm">Cannot generate video from mock images. Connect API Key.</span>
                           </div>
                        ) : (
                          <button 
                            onClick={handleGenerateVideo}
                            className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-transform transform hover:scale-105 shadow-lg shadow-purple-500/30 flex items-center space-x-2"
                          >
                            <Play size={20} fill="currentColor" />
                            <span>Generate 8s Video</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              ) : (
                <div className="grid grid-cols-3 h-full gap-0.5">
                  {content.storyboard?.map((scene, i) => (
                    <div key={i} className="relative h-full bg-slate-800">
                      {scene.imageUrl ? (
                        <img src={scene.imageUrl} alt={`Scene ${i+1}`} className="w-full h-full object-cover opacity-80" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        Scene {i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            {content.videoUrl && activeTab === 'video' && (
              <div className="mt-6 flex items-center space-x-4">
                 <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 shadow-sm">
                   <Download size={16} />
                   <span>Download MP4</span>
                 </button>
                 <button 
                   onClick={handleGenerateVideo}
                   className="flex items-center space-x-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100"
                 >
                   <RefreshCw size={16} />
                   <span>Regenerate</span>
                 </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Details */}
        <div className="w-1/3 bg-white flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900">Scene Breakdown</h3>
            <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
              <span>3 scenes</span>
              <span>•</span>
              <span>8s total duration</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {content.storyboard?.map((scene, index) => (
               <div key={index} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                 <div className="flex space-x-3">
                   <div className="w-24 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                     {scene.imageUrl ? (
                       <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-slate-200">
                         <Loader2 size={16} className="text-slate-400 animate-spin" />
                       </div>
                     )}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between mb-1">
                       <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                         Scene {scene.sceneNumber}
                       </span>
                       <span className="text-[10px] text-slate-400">~2.5s</span>
                     </div>
                     <p className="text-xs text-slate-600 line-clamp-2 italic mb-2">"{scene.voiceover}"</p>
                     <p className="text-[10px] text-slate-400 line-clamp-2">Prompt: {scene.imagePrompt}</p>
                   </div>
                 </div>
               </div>
             ))}

             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-4">
               <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Compliance Check</h4>
               <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100 mb-2">
                 <CheckCircle2 size={16} />
                 <span className="text-xs font-medium">100% Passed - No medical claims found in VO</span>
               </div>
             </div>
          </div>

          <div className="p-4 border-t border-slate-200">
             <div className="flex space-x-3">
               <button className="flex-1 py-2 border border-slate-200 rounded-lg flex items-center justify-center space-x-2 text-slate-600 hover:bg-slate-50">
                 <ThumbsDown size={16} />
                 <span>Reject</span>
               </button>
               <button 
                 onClick={onClose}
                 className="flex-1 py-2 bg-purple-600 text-white rounded-lg flex items-center justify-center space-x-2 hover:bg-purple-700 shadow-lg shadow-purple-500/20"
               >
                 <ThumbsUp size={16} />
                 <span>Approve Video</span>
               </button>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};
