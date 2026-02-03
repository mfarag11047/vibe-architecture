import React from 'react';
import { Bot, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { AgentStatus } from '../types';

interface AgentCardProps {
  name: string;
  role: string;
  model: string;
  isActive: boolean;
  isCompleted: boolean;
  isPending: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ name, role, model, isActive, isCompleted, isPending }) => {
  let statusColor = "border-slate-700 bg-slate-800/50 text-slate-500";
  
  if (isActive) {
    statusColor = "border-cyan-500 bg-cyan-950/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]";
  } else if (isCompleted) {
    statusColor = "border-emerald-600 bg-emerald-950/30 text-emerald-400";
  }

  return (
    <div className={`border rounded-lg p-4 transition-all duration-300 ${statusColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${isActive ? 'bg-cyan-500/10' : 'bg-slate-800'}`}>
            <Bot size={24} />
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider">{name}</h3>
            <p className="text-xs opacity-80">{role}</p>
          </div>
        </div>
        <div className="mt-1">
          {isActive && <Loader2 className="animate-spin" size={18} />}
          {isCompleted && <CheckCircle2 size={18} />}
          {isPending && <Circle size={18} className="opacity-30" />}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] uppercase font-mono opacity-60">
        <span className="px-1.5 py-0.5 rounded bg-black/20">{model}</span>
      </div>
    </div>
  );
};