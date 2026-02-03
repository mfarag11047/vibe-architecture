import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Play, Copy, Github, AlertCircle, Sparkles, Box, Bug, Layers, Wrench, RefreshCw, Image as ImageIcon, X } from 'lucide-react';
import { AgentStatus, AgentState, INITIAL_MISSION_LOG, RepoFile, ImageRef } from './types';
import { fetchRepoContents } from './services/githubService';
import { runScoutAgent, runArchitectAgent, runTaskmasterAgent, runRefinerAgent } from './services/geminiService';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { AgentCard } from './components/AgentCard';

interface ParsedPrompt {
  id: string;
  title: string;
  content: string;
}

// Helper to parse the multi-step prompt output
const parsePrompts = (text: string): ParsedPrompt[] => {
  const regex = /=== PROMPT (\d+): (.*?) ===([\s\S]*?)(?=(=== PROMPT|\z))/g;
  const matches = [...text.matchAll(regex)];

  if (matches.length === 0) {
    return [{ id: '1', title: 'Complete Mission', content: text }];
  }

  return matches.map(match => ({
    id: match[1],
    title: match[2],
    content: match[3].trim()
  }));
};

const App: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [objective, setObjective] = useState('');
  const [errorFeedback, setErrorFeedback] = useState('');
  const [referenceImages, setReferenceImages] = useState<ImageRef[]>([]);
  const [refinementInput, setRefinementInput] = useState('');
  
  const [state, setState] = useState<AgentState>({
    status: AgentStatus.IDLE,
    missionLog: INITIAL_MISSION_LOG,
    finalPrompt: null,
    error: null,
  });

  const repoFilesRef = useRef<RepoFile[]>([]);
  const missionLogEndRef = useRef<HTMLDivElement>(null);
  const promptsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    missionLogEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.missionLog]);

  useEffect(() => {
     if (state.status === AgentStatus.COMPLETED && state.finalPrompt) {
        promptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
     }
  }, [state.status, state.finalPrompt]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages: ImageRef[] = [];
      // Explicitly cast to File[] to avoid 'unknown' type inference issues
      const files = Array.from(e.target.files) as File[];
      
      const promises = files.map(file => {
        return new Promise<ImageRef>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Extract base64 and mime type
            // Data URL format: data:image/jpeg;base64,/9j/4AAQSk...
            const [header, base64] = result.split(',');
            const mimeType = header.match(/:(.*?);/)![1];
            resolve({ data: base64, mimeType });
          };
          reader.readAsDataURL(file);
        });
      });

      const processedImages = await Promise.all(promises);
      setReferenceImages(prev => [...prev, ...processedImages]);
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const executePipeline = async () => {
    if (!repoUrl || !objective) return;

    setState(prev => ({ ...prev, status: AgentStatus.FETCHING_REPO, error: null, missionLog: INITIAL_MISSION_LOG, finalPrompt: null }));

    try {
      // 1. Fetch Repo
      const files = await fetchRepoContents(repoUrl);
      repoFilesRef.current = files;
      
      // 2. Scout
      setState(prev => ({ ...prev, status: AgentStatus.SCOUT_WORKING }));
      const scoutLog = await runScoutAgent(objective, errorFeedback, files, referenceImages);
      setState(prev => ({ ...prev, missionLog: scoutLog }));

      // 3. Architect
      setState(prev => ({ ...prev, status: AgentStatus.ARCHITECT_WORKING }));
      const architectLog = await runArchitectAgent(scoutLog, objective, errorFeedback, referenceImages);
      setState(prev => ({ ...prev, missionLog: architectLog }));

      // 4. Taskmaster
      setState(prev => ({ ...prev, status: AgentStatus.TASKMASTER_WORKING }));
      const finalPrompt = await runTaskmasterAgent(architectLog, files);
      
      setState(prev => ({ 
        ...prev, 
        status: AgentStatus.COMPLETED, 
        finalPrompt: finalPrompt 
      }));

    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        status: AgentStatus.ERROR, 
        error: err.message || "An unexpected error occurred in the pipeline." 
      }));
    }
  };

  const executeRefinement = async () => {
    if (!refinementInput || !state.finalPrompt) return;
    
    setState(prev => ({ ...prev, status: AgentStatus.REFINING, error: null }));
    
    try {
        const updatedPrompts = await runRefinerAgent(
            state.finalPrompt, 
            refinementInput, 
            state.missionLog, 
            repoFilesRef.current
        );
        
        setState(prev => ({
            ...prev,
            status: AgentStatus.COMPLETED,
            finalPrompt: updatedPrompts
        }));
        
        setRefinementInput(''); 
    } catch (err: any) {
        setState(prev => ({ 
            ...prev, 
            status: AgentStatus.ERROR, 
            error: err.message || "Failed to refine instructions." 
        }));
    }
  };

  const isProcessing = state.status !== AgentStatus.IDLE && state.status !== AgentStatus.COMPLETED && state.status !== AgentStatus.ERROR;
  const isRefining = state.status === AgentStatus.REFINING;
  const parsedPrompts = state.finalPrompt ? parsePrompts(state.finalPrompt) : [];

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[#0B1121]">
      
      {/* LEFT PANEL: INPUTS */}
      <div className="w-full md:w-1/3 border-r border-slate-800 flex flex-col h-screen">
        <div className="p-6 border-b border-slate-800 bg-[#0f172a]">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20">
              <Box className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
              Vibe Architect
            </h1>
          </div>
          <p className="text-slate-400 text-sm">Multi-Agent Staging Area for AI Coding</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Target Repository
              </label>
              <div className="relative group">
                <Github className="absolute left-3 top-3 text-slate-500 group-focus-within:text-cyan-400 transition-colors" size={18} />
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600 text-sm"
                  disabled={isProcessing || isRefining}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mission Objective
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Describe the feature you want to add or the bug you want to fix..."
                className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600 text-sm resize-none"
                disabled={isProcessing || isRefining}
              />
              
              {/* Image Upload Area */}
              <div className="mt-3">
                 <input 
                   type="file" 
                   ref={fileInputRef}
                   onChange={handleImageUpload}
                   className="hidden" 
                   accept="image/*"
                   multiple
                 />
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || isRefining}
                    className="text-xs flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors font-semibold"
                 >
                    <ImageIcon size={14} />
                    {referenceImages.length > 0 ? 'Add More Images' : 'Attach Reference Images (Optional)'}
                 </button>
                 
                 {referenceImages.length > 0 && (
                   <div className="grid grid-cols-4 gap-2 mt-3">
                      {referenceImages.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700">
                           <img 
                              src={`data:${img.mimeType};base64,${img.data}`} 
                              alt={`Ref ${idx}`} 
                              className="w-full h-full object-cover"
                           />
                           <button 
                             onClick={() => removeImage(idx)}
                             disabled={isProcessing}
                             className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                           >
                             <X size={12} />
                           </button>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
            </div>

             <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                <Bug size={14} />
                Initial Error Context (Optional)
              </label>
              <textarea
                value={errorFeedback}
                onChange={(e) => setErrorFeedback(e.target.value)}
                placeholder="Paste any preview errors or console logs here BEFORE starting..."
                className="w-full h-24 bg-red-950/10 border border-red-900/30 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-red-900/50 text-sm resize-none"
                disabled={isProcessing || isRefining}
              />
            </div>

            <button
              onClick={executePipeline}
              disabled={isProcessing || isRefining || !repoUrl || !objective}
              className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all shadow-lg
                ${isProcessing || isRefining || !repoUrl || !objective 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/20 hover:shadow-cyan-500/30'
                }`}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Running Pipeline...</span>
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  <span>Execute Pipeline</span>
                </>
              )}
            </button>
          </div>

          {/* Pipeline Visualization */}
          <div className="space-y-3 pt-6 border-t border-slate-800/50">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Pipeline Status</h3>
            
            <AgentCard 
              name="Repo Scout" 
              role="Ingestion & Filtering" 
              model="Gemini 3 Pro" 
              isActive={state.status === AgentStatus.SCOUT_WORKING || state.status === AgentStatus.FETCHING_REPO}
              isCompleted={state.status === AgentStatus.ARCHITECT_WORKING || state.status === AgentStatus.TASKMASTER_WORKING || state.status === AgentStatus.REFINING || state.status === AgentStatus.COMPLETED}
              isPending={state.status === AgentStatus.IDLE}
            />

            <AgentCard 
              name="Logic Architect" 
              role="Planning & Safety" 
              model="Gemini 3 Pro" 
              isActive={state.status === AgentStatus.ARCHITECT_WORKING}
              isCompleted={state.status === AgentStatus.TASKMASTER_WORKING || state.status === AgentStatus.REFINING || state.status === AgentStatus.COMPLETED}
              isPending={state.status === AgentStatus.IDLE || state.status === AgentStatus.FETCHING_REPO || state.status === AgentStatus.SCOUT_WORKING}
            />

            <AgentCard 
              name="The Taskmaster" 
              role="Sequence Planning" 
              model="Gemini 3 Pro" 
              isActive={state.status === AgentStatus.TASKMASTER_WORKING}
              isCompleted={state.status === AgentStatus.REFINING || state.status === AgentStatus.COMPLETED}
              isPending={state.status !== AgentStatus.TASKMASTER_WORKING && state.status !== AgentStatus.COMPLETED && state.status !== AgentStatus.REFINING}
            />
          </div>

          {state.error && (
            <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-lg flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{state.error}</p>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT PANEL: MISSION LOG & OUTPUT */}
      <div className="w-full md:w-2/3 h-screen flex flex-col bg-[#0B1121] relative">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2 text-slate-300 font-mono text-sm">
            <Terminal size={16} className="text-cyan-500" />
            <span className="opacity-50">~/mission_control/</span>
            <span className="text-cyan-400">shared_context.md</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="text-[10px] uppercase font-bold tracking-widest text-slate-600 flex items-center gap-1.5">
               <div className={`w-2 h-2 rounded-full ${state.status === AgentStatus.IDLE ? 'bg-slate-600' : 'bg-green-500 animate-pulse'}`}></div>
               Live Feed
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {state.finalPrompt ? (
             <div className="animate-fadeIn pb-32"> {/* Added padding-bottom for fixed footer or spacing */}
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="text-yellow-400" size={20} />
                    Ready for Vibe Agent
                  </h2>
                  <div className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">
                    {parsedPrompts.length} Chunk{parsedPrompts.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="space-y-8">
                  {parsedPrompts.map((prompt, index) => (
                    <div key={prompt.id} className="relative group">
                       <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-900/50 to-transparent"></div>
                       
                       <div className="flex items-center justify-between mb-2 pl-2">
                          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                             <Layers size={14} />
                             Step {prompt.id}: {prompt.title}
                          </h3>
                          <button 
                            onClick={() => handleCopy(prompt.content)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded text-xs font-semibold transition-all border border-slate-700 hover:border-cyan-500"
                          >
                            <Copy size={14} />
                            Copy Chunk
                          </button>
                       </div>
                       
                       <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar shadow-xl">
                          {prompt.content}
                       </div>
                    </div>
                  ))}
                </div>

                {/* Refinement Section */}
                <div className="mt-12 bg-orange-950/20 border border-orange-900/40 rounded-xl p-6" ref={promptsEndRef}>
                  <div className="flex items-center gap-2 mb-4 text-orange-400">
                    <Wrench size={18} />
                    <h3 className="font-bold text-sm uppercase tracking-wider">Instruction Repair & Refinement</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">
                    Encountered an issue with the instructions? Describe the error below (e.g., "Step 2 failed with a syntax error in App.tsx"). The Refiner Agent will analyze the existing prompts and attempt to fix them or add missing steps.
                  </p>
                  
                  <div className="flex gap-3">
                    <textarea
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      placeholder="Describe the error or adjustment needed..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-600 text-sm h-24 resize-none"
                      disabled={isRefining}
                    />
                    <button
                      onClick={executeRefinement}
                      disabled={isRefining || !refinementInput}
                      className={`px-6 rounded-lg font-semibold transition-all shadow-lg flex items-center justify-center gap-2
                        ${isRefining || !refinementInput
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-900/20 hover:shadow-orange-500/30'
                        }`}
                    >
                      {isRefining ? (
                         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                         <>
                           <RefreshCw size={18} />
                           <span>Auto-Fix</span>
                         </>
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="mt-12 border-t border-slate-800 pt-8 opacity-50">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Historical Context</h3>
                   <MarkdownRenderer content={state.missionLog} />
                </div>
             </div>
          ) : (
             <div className="max-w-3xl mx-auto">
                <MarkdownRenderer content={state.missionLog} />
                <div ref={missionLogEndRef} />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;