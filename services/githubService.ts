import { RepoFile } from '../types';

const GITHUB_API_BASE = 'https://api.github.com/repos';

// Helper to parse "https://github.com/owner/repo"
const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    const cleanUrl = url.replace(/\/$/, ''); // Remove trailing slash
    const parts = cleanUrl.split('/');
    if (parts.length < 2) return null;
    const repo = parts[parts.length - 1];
    const owner = parts[parts.length - 2];
    return { owner, repo };
  } catch (e) {
    return null;
  }
};

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export const fetchRepoContents = async (repoUrl: string): Promise<RepoFile[]> => {
  const repoInfo = parseRepoUrl(repoUrl);
  if (!repoInfo) {
    throw new Error("Invalid GitHub URL format. Use https://github.com/owner/repo");
  }

  const { owner, repo } = repoInfo;

  // 1. Get the Git Tree (Recursive) to find all files
  // Note: For a demo, we use the public API which has rate limits (60/hr unauthenticated).
  // In a production app, you'd want to auth this or use a proxy.
  const treeUrl = `${GITHUB_API_BASE}/${owner}/${repo}/git/trees/main?recursive=1`;
  
  // Fallback to 'master' if main fails is a common pattern, but we'll try main first.
  let response = await fetch(treeUrl);
  
  if (!response.ok && response.status === 404) {
      // Try master branch
      response = await fetch(`${GITHUB_API_BASE}/${owner}/${repo}/git/trees/master?recursive=1`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch repo tree: ${response.statusText}. Ensure repo is public.`);
  }

  const data = await response.json();
  const tree: GitHubTreeItem[] = data.tree;

  // 2. Filter for relevant code files to avoid bloating context
  // Exclude images, locks, etc.
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css', '.html', '.json', '.md'];
  const relevantFiles = tree.filter(item => {
    if (item.type !== 'blob') return false;
    const isCode = codeExtensions.some(ext => item.path.endsWith(ext));
    // Skip package-lock, yarn.lock, node_modules, etc.
    const isLock = item.path.includes('lock') || item.path.includes('node_modules') || item.path.includes('dist/') || item.path.includes('build/');
    return isCode && !isLock;
  });

  // 3. Limit the number of files for the demo to avoid context overflow/rate limits
  // We prioritize package.json for environment checks (React 19, etc)
  relevantFiles.sort((a, b) => {
    // Prioritize package.json
    if (a.path.endsWith('package.json')) return -1;
    if (b.path.endsWith('package.json')) return 1;
    // Prioritize root files
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    return aDepth - bDepth;
  });

  const limitedFiles = relevantFiles.slice(0, 20); // Hard limit for demo stability

  // 4. Fetch content for each file
  const filePromises = limitedFiles.map(async (file) => {
    // We use the raw user content URL to get the raw text easily
    // https://raw.githubusercontent.com/owner/repo/branch/path
    const branch = data.url.includes('master') ? 'master' : 'main'; // heuristic
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
    
    try {
        const fileRes = await fetch(rawUrl);
        if(!fileRes.ok) return null;
        const text = await fileRes.text();
        return {
            path: file.path,
            content: text,
            size: file.size || text.length
        } as RepoFile;
    } catch (e) {
        console.warn(`Failed to fetch content for ${file.path}`, e);
        return null;
    }
  });

  const results = await Promise.all(filePromises);
  return results.filter((f): f is RepoFile => f !== null);
};