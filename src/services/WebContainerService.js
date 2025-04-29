import { WebContainer } from '@webcontainer/api';

/**
 * Service for managing WebContainer operations
 */
class WebContainerService {
  constructor() {
    this.instance = null;
    this.listeners = {
      'server-ready': []
    };
  }

  /**
   * Initialize the WebContainer
   * @returns {Promise<WebContainer>} The WebContainer instance
   */
  async boot() {
    if (this.instance) {
      return this.instance;
    }

    this.instance = await WebContainer.boot();

    // Forward server-ready events
    this.instance.on('server-ready', (port, url) => {
      this.listeners['server-ready'].forEach(callback => callback(port, url));
    });

    return this.instance;
  }

  /**
   * Add event listener
   * @param {string} event Event name
   * @param {Function} callback Callback function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   * @param {string} event Event name
   * @param {Function} callback Callback function
   */
  off(event, callback) {
    if (!this.listeners[event]) return;

    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Run a command in the WebContainer
   * @param {string} cmd Command to run
   * @param {string[]} args Command arguments
   * @returns {Promise<{exitCode: number, output: string}>} Command result
   */
  async runCommand(cmd, args = []) {
    if (!this.instance) {
      throw new Error('WebContainer not initialized');
    }

    const process = await this.instance.spawn(cmd, args);

    // Collect output
    let output = '';
    const writableStream = new WritableStream({
      write(data) {
        output += data;
      }
    });

    process.output.pipeTo(writableStream);
    const exitCode = await process.exit;

    return { exitCode, output };
  }

  /**
   * Run a command in the shell
   * @param {string} command Full shell command
   * @returns {Promise<{exitCode: number, output: string}>} Command result
   */
  async runShellCommand(command) {
    return this.runCommand('sh', ['-c', command]);
  }

  /**
   * Setup basic file system structure
   */
  async setupFileSystem() {
    if (!this.instance) {
      throw new Error('WebContainer not initialized');
    }

    try {
      // Create a basic package.json if it doesn't exist
      const rootFiles = await this.instance.fs.readdir('/').catch(() => []);

      if (!rootFiles.includes('package.json')) {
        const packageJson = JSON.stringify({
          name: 'web-container-project',
          type: 'module',
          dependencies: {
            "codex-lacy": "latest"
          },
          scripts: {
            "codex": "node ./node_modules/codex-lacy/bin/codex.js",
            "run-codex": "node ./node_modules/codex-lacy/bin/codex.js"
          }
        }, null, 2);

        await this.instance.fs.writeFile('/package.json', packageJson);
      }

      // Create node_modules directory with proper permissions if it doesn't exist
      if (!rootFiles.includes('node_modules')) {
        await this.instance.fs.mkdir('/node_modules', { recursive: true });
      }

      // Create .bin directory for executable scripts
      await this.instance.fs.mkdir('/node_modules/.bin', { recursive: true }).catch(() => {});

      // Create a codex-lacy directory
      await this.instance.fs.mkdir('/node_modules/codex-lacy/bin', { recursive: true }).catch(() => {});
    } catch (error) {
      console.error('Error setting up file system:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const webContainerService = new WebContainerService();
export default webContainerService;
