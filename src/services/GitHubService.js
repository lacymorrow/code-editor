import webContainerService from './WebContainerService';

/**
 * Service for GitHub repository operations
 */
class GitHubService {
  /**
   * Check if a URL is a valid GitHub URL
   * @param {string} url GitHub repository URL
   * @returns {boolean} Whether the URL is valid
   */
  isValidGitHubUrl(url) {
    const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-_.]+\/?$/;
    return githubRegex.test(url);
  }

  /**
   * Extract owner and repo name from GitHub URL
   * @param {string} url GitHub repository URL
   * @returns {Object} Repository info {user, repo}
   */
  extractRepoInfo(url) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match || match.length < 3) {
      throw new Error('Invalid GitHub URL format');
    }

    return {
      user: match[1],
      repo: match[2].replace(/\/$/, '') // Remove trailing slash if present
    };
  }

  /**
   * Check GitHub API rate limit
   * @returns {Promise<number|null>} Remaining API requests or null if check fails
   */
  async checkRateLimit() {
    try {
      const response = await fetch('https://api.github.com/rate_limit');
      if (response.ok) {
        const data = await response.json();
        return data.resources.core.remaining;
      }
    } catch (error) {
      console.error('Failed to check rate limit:', error);
    }
    return null;
  }

  /**
   * Fetch repository contents and load them into WebContainer
   * @param {string} user GitHub username
   * @param {string} repo Repository name
   * @param {Function} progressCallback Callback for progress updates
   * @returns {Promise<void>}
   */
  async fetchAndLoadRepository(user, repo, progressCallback = () => {}) {
    try {
      const webContainer = webContainerService.instance;
      if (!webContainer) {
        throw new Error('WebContainer not initialized');
      }

      // Clear previous files if any
      await webContainer.fs.rm('/', { recursive: true, force: true }).catch(() => {});

      // Fetch the repository info to get default branch
      progressCallback('Fetching repository information...');
      const repoResponse = await fetch(`https://api.github.com/repos/${user}/${repo}`);

      if (!repoResponse.ok) {
        const errorText = await repoResponse.text();
        console.error('GitHub API Error:', repoResponse.status, errorText);
        throw new Error(`Failed to fetch repository: ${repoResponse.status} ${repoResponse.statusText}. Make sure the repository exists and is public.`);
      }

      const repoData = await repoResponse.json();
      const defaultBranch = repoData.default_branch;

      // Fetch the file tree
      progressCallback(`Fetching file tree from branch: ${defaultBranch}`);
      const treeResponse = await fetch(`https://api.github.com/repos/${user}/${repo}/git/trees/${defaultBranch}?recursive=1`);

      if (!treeResponse.ok) {
        const errorText = await treeResponse.text();
        console.error('GitHub API Tree Error:', treeResponse.status, errorText);
        throw new Error(`Failed to fetch file tree: ${treeResponse.status} ${treeResponse.statusText}. The repository might be too large.`);
      }

      const treeData = await treeResponse.json();

      // Check if we got truncated results (large repository)
      if (treeData.truncated) {
        progressCallback('Warning: Repository is too large and file list is truncated. Some files may not be loaded.', true);
      }

      // Download and write files to WebContainer
      progressCallback('Downloading files...');

      const files = treeData.tree.filter(item => item.type === 'blob');
      let processedFiles = 0;
      const totalFiles = files.length;

      // Process files in batches to avoid overwhelming the browser
      const BATCH_SIZE = 10;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async file => {
          try {
            const filePath = file.path;
            const fileUrl = `https://raw.githubusercontent.com/${user}/${repo}/${defaultBranch}/${filePath}`;

            // Fetch the file content
            const contentResponse = await fetch(fileUrl);

            if (!contentResponse.ok) {
              console.warn(`Failed to fetch file ${filePath}: ${contentResponse.status} ${contentResponse.statusText}`);
              return; // Skip this file and continue with others
            }

            // Check if we need to create parent directories
            const dirPath = filePath.split('/').slice(0, -1).join('/');
            if (dirPath) {
              await webContainer.fs.mkdir(dirPath, { recursive: true });
            }

            // Write the file to WebContainer
            const content = await contentResponse.text();
            await webContainer.fs.writeFile(filePath, content);

            processedFiles++;
            if (processedFiles % 10 === 0 || processedFiles === totalFiles) {
              progressCallback(`Downloading files... (${processedFiles}/${totalFiles})`);
            }
          } catch (error) {
            console.error(`Error processing file ${file.path}:`, error);
            // Continue with other files even if one fails
          }
        }));
      }

      progressCallback(`Downloaded ${processedFiles} files successfully.`);

      // Return results
      return {
        totalFiles: processedFiles,
        hasPackageJson: (await webContainer.fs.readdir('/')).includes('package.json')
      };
    } catch (error) {
      console.error('Error in fetchAndLoadRepository:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const gitHubService = new GitHubService();
export default gitHubService;