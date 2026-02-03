export enum AgentStatus {
  IDLE = 'IDLE',
  FETCHING_REPO = 'FETCHING_REPO',
  SCOUT_WORKING = 'SCOUT_WORKING',
  ARCHITECT_WORKING = 'ARCHITECT_WORKING',
  TASKMASTER_WORKING = 'TASKMASTER_WORKING',
  REFINING = 'REFINING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface RepoFile {
  path: string;
  content: string;
  size: number;
}

export interface ImageRef {
  data: string; // base64 encoded data
  mimeType: string;
}

export interface AgentState {
  status: AgentStatus;
  missionLog: string;
  finalPrompt: string | null;
  error: string | null;
}

export interface PipelineConfig {
  repoUrl: string;
  missionObjective: string;
}

export const INITIAL_MISSION_LOG = `# MISSION CONTROL
**Language:** TypeScript (.tsx)
**Framework:** React 18+ (ESM)

## ENVIRONMENT MANIFESTO (IMMUTABLE LAWS)
* **SDK:** MUST use \`@google/genai\` (NOT \`@google/generative-ai\`).
* **Styling:** Tailwind via CDN only. NO \`.css\` files. NO \`styled-components\`.
* **Routing:** \`HashRouter\` only (No history API).
* **Icons:** \`lucide-react\` only.
* **Structure:** Flat root (./). NO \`/src\` folder. \`index.tsx\` is entry.
* **TS Rules:** Use \`interface\` (not type). Use \`enum\` (not const enum).
`;