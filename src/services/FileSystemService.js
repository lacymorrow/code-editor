import webContainerService from './WebContainerService';
import uiService from './UIService';

/**
 * Service for file system operations
 */
class FileSystemService {
  constructor() {
    this.fileTree = null;
    this.currentPath = '/';
  }

  /**
   * Set file tree
   * @param {Object} fileTree File tree object
   */
  setFileTree(fileTree) {
    this.fileTree = fileTree;
  }

  /**
   * Get current path
   * @returns {string} Current path
   */
  getCurrentPath() {
    return this.currentPath;
  }

  /**
   * Set current path
   * @param {string} path New path
   */
  setCurrentPath(path) {
    this.currentPath = path;
  }

  /**
   * Refresh file tree
   */
  refreshFileTree() {
    if (this.fileTree) {
      this.fileTree.refresh();
    }
  }

  /**
   * View file contents
   * @param {string} filePath Path to file
   */
  async viewFile(filePath) {
    try {
      if (!webContainerService.instance) {
        throw new Error('WebContainer not initialized');
      }

      const content = await webContainerService.instance.fs.readFile(filePath, 'utf-8');
      uiService.writeToConsole(`----- File: ${filePath} -----\n\n${content}\n\n----- End of file: ${filePath} -----`);
      uiService.updateStatus(`Viewing file: ${filePath}`);
    } catch (error) {
      console.error('Error reading file:', error);
      uiService.writeToConsole(`Error reading file ${filePath}: ${error.message}`, true);
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath Path to file
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(filePath) {
    try {
      if (!webContainerService.instance) {
        return false;
      }

      await webContainerService.instance.fs.stat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a file
   * @param {string} filePath Path to file
   * @param {string} content File content
   */
  async createFile(filePath, content) {
    try {
      if (!webContainerService.instance) {
        throw new Error('WebContainer not initialized');
      }

      // Create parent directory if it doesn't exist
      const dirPath = filePath.split('/').slice(0, -1).join('/');
      if (dirPath) {
        await webContainerService.instance.fs.mkdir(dirPath, { recursive: true }).catch(() => {});
      }

      await webContainerService.instance.fs.writeFile(filePath, content);
      this.refreshFileTree();
      return true;
    } catch (error) {
      console.error('Error creating file:', error);
      uiService.writeToConsole(`Error creating file ${filePath}: ${error.message}`, true);
      return false;
    }
  }

  /**
   * Create a directory
   * @param {string} dirPath Path to directory
   */
  async createDirectory(dirPath) {
    try {
      if (!webContainerService.instance) {
        throw new Error('WebContainer not initialized');
      }

      await webContainerService.instance.fs.mkdir(dirPath, { recursive: true });
      this.refreshFileTree();
      return true;
    } catch (error) {
      console.error('Error creating directory:', error);
      uiService.writeToConsole(`Error creating directory ${dirPath}: ${error.message}`, true);
      return false;
    }
  }

  /**
   * Delete a file or directory
   * @param {string} path Path to file or directory
   * @param {boolean} isDirectory Whether it's a directory
   */
  async deletePath(path, isDirectory = false) {
    try {
      if (!webContainerService.instance) {
        throw new Error('WebContainer not initialized');
      }

      await webContainerService.instance.fs.rm(path, { recursive: isDirectory, force: true });
      this.refreshFileTree();
      return true;
    } catch (error) {
      console.error('Error deleting path:', error);
      uiService.writeToConsole(`Error deleting ${path}: ${error.message}`, true);
      return false;
    }
  }
}

// Export a singleton instance
const fileSystemService = new FileSystemService();
export default fileSystemService;
