import { GoogleGenAI } from "@google/genai";
import { RepoFile, ImageRef } from "../types";

// Initialize the client. API_KEY is expected from environment.
// In this specific demo environment, we assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const formatRepoForPrompt = (files: RepoFile[]): string => {
  return files.map(f => `
--- START FILE: ${f.path} ---
${f.content}
--- END FILE: ${f.path} ---
`).join('\n');
};

/**
 * AGENT 1: THE REPO SCOUT
 * Model: gemini-3-pro-preview
 */
export const runScoutAgent = async (objective: string, errorFeedback: string, files: RepoFile[], images: ImageRef[] = []): Promise<string> => {
  const fileContext = formatRepoForPrompt(files);
  
  const systemInstruction = `You are the Scout. Analyze the user's 'Mission Objective' (and any attached reference images) along with the provided GitHub Repo.

  **Compliance Audit:**
  1.  **Structure:** Verify the repo uses a flat structure (no \`/src\` folder). If it uses \`/src\`, note in 'Critical Context' that paths must be flattened for the Vibe environment.
  2.  **Forbidden Files:** Check for \`.css\`, \`.scss\`, or \`.less\` files. These are banned (Tailwind only).
  3.  **Legacy SDK:** Check for \`@google/generative-ai\`. Flag this, as strict usage of \`@google/genai\` is required.

  **Filter Noise:** Identify ONLY the files necessary for this specific mission. Do not list every file.

  **Summarize State:** Briefly explain what the current code in those specific files is doing.

  **Output:** Update the \`MISSION_LOG\`. Preserve the 'ENVIRONMENT MANIFESTO'.
  Add sections for:
  *   \`## RELEVANT FILES\`
  *   \`## CRITICAL CONTEXT\` (Include compliance audit findings here)
  `;

  const textPrompt = `
  MISSION OBJECTIVE:
  ${objective}

  ERROR FEEDBACK (Issues to fix):
  ${errorFeedback || "None"}
  
  REPOSITORY CONTENT:
  ${fileContext}
  `;

  // Construct multimodal content
  const parts: any[] = [{ text: textPrompt }];
  
  images.forEach(img => {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Low temp for factual analysis
      }
    });
    return response.text || "Error generating Scout response.";
  } catch (error) {
    console.error("Scout Error:", error);
    throw new Error("Scout Agent failed to analyze repository.");
  }
};

/**
 * AGENT 2: THE LOGIC ARCHITECT
 * Model: gemini-3-pro-preview
 */
export const runArchitectAgent = async (currentMissionLog: string, objective: string, errorFeedback: string, images: ImageRef[] = []): Promise<string> => {
  
  const systemInstruction = `You are the Architect. Read the \`MISSION_LOG\`.

  **Plan the Logic:** Write pseudo-code for the requested feature.
  *   **Constraint (UI):** If adding UI, use ONLY Tailwind utility classes.
  *   **Constraint (AI):** If adding AI features, use the pattern: \`const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });\`.

  **Red Team the Plan:** Look for conflicts.
  *   Example: "Does this state change trigger a re-render loop in React 18?"
  *   Example: "Are we importing a file that doesn't exist in the flat structure?"

  **Define Constraints:** Explicitly list variables/functions that MUST NOT be modified.

  **Output:** Append your findings to the \`MISSION_LOG\` under \`## HAZARD REGISTRY (DO NOT TOUCH)\` and \`## IMPLEMENTATION PLAN\`.
  `;

  const textPrompt = `
  ORIGINAL OBJECTIVE:
  ${objective}

  ERROR FEEDBACK:
  ${errorFeedback || "None"}

  CURRENT MISSION LOG:
  ${currentMissionLog}
  `;

  const parts: any[] = [{ text: textPrompt }];
  
  images.forEach(img => {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data
      }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.4, // Balanced for planning
      }
    });
    return response.text || "Error generating Architect response.";
  } catch (error) {
    console.error("Architect Error:", error);
    throw new Error("Architect Agent failed to plan.");
  }
};

/**
 * AGENT 3: THE TASKMASTER
 * Model: gemini-3-pro-preview
 */
export const runTaskmasterAgent = async (fullMissionLog: string, files: RepoFile[]): Promise<string> => {
  const fileContext = formatRepoForPrompt(files);

  const systemInstruction = `You are the Taskmaster. Your goal is to break down the implementation into a series of **sequential, manageable prompts** for the Vibe Agent.

  **Reasoning:**
  To prevent the coding agent from getting overloaded or producing lazy code, you must split the Mission into logical chunks (e.g., 2-3 steps).

  **Structure:**
  Separate each prompt chunk clearly with this separator:
  \`=== PROMPT [Number]: [Short Title] ===\`

  **Template for EACH Prompt Chunk:**
  1.  **Header:** 'Act as a surgical code editor. Environment: React 18+, ESM, Tailwind(CDN), HashRouter.'
  2.  **The Iron Rules (Must be included in EVERY chunk):**
      *   'CRITICAL: Use \`@google/genai\` only. Do not import \`google-generative-ai\`.'
      *   'CRITICAL: Do NOT create \`.css\` files. Use Tailwind classes.'
      *   'CRITICAL: Regenerate the FULL file content for the files being modified. No placeholders like \`// ... rest of code\`. The previewer will fail if you do this.'
      *   'CRITICAL: Maintain \`export default\` on main components.'
  3.  **The Task:** "Step [N] of [Total]: [Description of what to build in this step]."
  4.  **Context:**
      *   Include the raw code of *only* the files needed for this specific step (from Repository Content).
      *   Include the relevant pseudo-code from the Mission Log.
  5.  **Constraints:** "Ensure you respect the Hazard Registry: [Relevant items]."

  **Output Rules:**
  *   Do NOT output markdown code blocks for the prompt text itself.
  *   Just output the raw text separated by the headers.
  `;

  const prompt = `
  FULL MISSION LOG:
  ${fullMissionLog}
  
  REPOSITORY CONTENT (Reference for file contents):
  ${fileContext}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3, 
      }
    });
    return response.text || "Error generating Taskmaster response.";
  } catch (error) {
    console.error("Taskmaster Error:", error);
    throw new Error("Taskmaster Agent failed to synthesize prompt.");
  }
};

/**
 * AGENT 4: THE REFINER (Repair Technician)
 * Model: gemini-3-pro-preview
 */
export const runRefinerAgent = async (currentPrompts: string, feedback: string, fullMissionLog: string, files: RepoFile[]): Promise<string> => {
  // We need context to fix things, but maybe not ALL files if the prompts are huge. 
  // For Vibe, passing full context is usually safer for accuracy.
  const fileContext = formatRepoForPrompt(files);

  const systemInstruction = `You are the Repair Technician. You have a set of coding instructions (Prompts) generated for the Vibe Agent. The user has reported an error or requested a change.

  **Your Job:** 
  Modify the existing prompts or ADD a new prompt to fix the issue described by the user.

  **Rules:**
  1.  **Analyze:** Look at the 'Current Prompts' and the 'User Feedback'. Determine if a specific step caused the error or if a new step is needed.
  2.  **Edit vs Add:**
      *   If an existing step is wrong (e.g., syntax error, missing import), REWRITE that specific prompt chunk. Keep the same ID/Title if possible.
      *   If something was missed entirely, ADD a new chunk at the end (increment the ID).
  3.  **Preserve Structure:** You MUST return the **FULL set of prompts** (including the ones you didn't change). Maintain the separator: \`=== PROMPT [Number]: [Title] ===\`.
  4.  **Iron Rules:** Ensure any new or edited code instructions still follow the Vibe Environment rules (React 18+, No CSS files, @google/genai only).

  **Output:**
  Return the raw text of the updated prompt sequence.
  `;

  const prompt = `
  CONTEXT - MISSION LOG:
  ${fullMissionLog}

  CONTEXT - REPO FILES:
  ${fileContext}

  === CURRENT PROMPTS (To be fixed) ===
  ${currentPrompts}

  === USER FEEDBACK / ERROR REPORT ===
  ${feedback}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Low temp for precise fixing
      }
    });
    return response.text || "Error generating Refiner response.";
  } catch (error) {
    console.error("Refiner Error:", error);
    throw new Error("Refiner Agent failed to fix instructions.");
  }
};