import webContainerService from './WebContainerService';
import terminalService from './TerminalService';

/**
 * Service for command execution
 */
class CommandService {
  constructor() {
    this.onFileSystemChange = null;
    this.onServerStart = null;
  }

  /**
   * Register file system change callback
   * @param {Function} callback Function to call when file system changes
   */
  registerFileSystemChangeCallback(callback) {
    this.onFileSystemChange = callback;
  }

  /**
   * Register server start callback
   * @param {Function} callback Function to call when server starts
   */
  registerServerStartCallback(callback) {
    this.onServerStart = callback;
  }

  /**
   * Process a terminal command
   * @param {string} command Command to process
   */
  async processCommand(command) {
    try {
      if (!webContainerService.instance) {
        throw new Error('WebContainer not initialized');
      }

      // Parse the command
      const [cmd, ...args] = command.split(' ');

      // Special handling for npm start, dev, etc. to connect to the preview
      if (cmd === 'npm' && ['start', 'run'].includes(args[0])) {
        await this.runDevServer(command);
      }
      // Special handling for npx commands which may need different permissions
      else if (cmd === 'npx') {
        await this.runNpxCommand(args);
      }
      else {
        // For other commands
        await this.runCommand(cmd, args);
      }
    } catch (error) {
      console.error('Command execution failed:', error);
      terminalService.write(`Error: ${error.message}`, true);
    }
  }

  /**
   * Run a general command
   * @param {string} cmd Command to run
   * @param {string[]} args Command arguments
   */
  async runCommand(cmd, args) {
    try {
      // Spawn the process
      const process = await webContainerService.instance.spawn(cmd, args);

      // Create a writable stream to pipe to xterm
      const writableStream = new WritableStream({
        write(data) {
          terminalService.write(data);
        }
      });

      // Listen for process output
      process.output.pipeTo(writableStream);

      // Check for file system operations
      const fileSystemCommands = ['mkdir', 'rm', 'touch', 'cp', 'mv'];
      if (fileSystemCommands.includes(cmd) && args && args.length > 0) {
        // Refresh file tree after file system operations
        setTimeout(() => {
          if (this.onFileSystemChange) {
            this.onFileSystemChange();
          }
        }, 500);
      }

      // Get the exit code
      const exitCode = await process.exit;

      // Handle exit code
      if (exitCode === 13) {
        terminalService.write(`Process exited with code ${exitCode} (Permission denied or resource issue)`, true);
        // Try to recover if this was due to a file system operation
        if (this.onFileSystemChange) {
          this.onFileSystemChange();
        }
      } else if (exitCode !== 0) {
        terminalService.write(`Process exited with code ${exitCode}`, true);
      } else {
        terminalService.write(`Process completed successfully`);
      }
    } catch (error) {
      console.error('Command execution error:', error);
      terminalService.write(`Error: ${error.message}`, true);
    }
  }

  /**
   * Run npx commands
   * @param {string[]} args Command arguments
   */
  async runNpxCommand(args) {
    try {
      // Special handling for codex-lacy
      if (args[0] === 'codex-lacy') {
        terminalService.write('Using direct path execution for codex-lacy...');

        // First try npm script way
        const process = await webContainerService.instance.spawn('npm', ['run', 'codex', '--', ...args.slice(1)]);

        const writableStream = new WritableStream({
          write(data) {
            terminalService.write(data);
          }
        });

        process.output.pipeTo(writableStream);
        await process.exit;
      } else {
        // For other npx commands, try normal execution
        const process = await webContainerService.instance.spawn('npx', args);

        const writableStream = new WritableStream({
          write(data) {
            terminalService.write(data);
          }
        });

        process.output.pipeTo(writableStream);
        const exitCode = await process.exit;

        if (exitCode === 13) {
          terminalService.write(`Process exited with code 13 (Permission denied), trying alternative method...`, true);

          // Try with npm exec as fallback
          const npmProcess = await webContainerService.instance.spawn('npm', ['exec', '--', ...args]);

          const npmWritableStream = new WritableStream({
            write(data) {
              terminalService.write(data);
            }
          });

          npmProcess.output.pipeTo(npmWritableStream);
          await npmProcess.exit;
        }
      }
    } catch (error) {
      console.error('NPX command execution error:', error);
      terminalService.write(`Error running npx command: ${error.message}`, true);
    }
  }

  /**
   * Run development server
   * @param {string} fullCommand Full command string to run
   */
  async runDevServer(fullCommand) {
    try {
      terminalService.write('Starting development server...');

      // Start the server process
      const process = await webContainerService.instance.spawn('sh', ['-c', fullCommand]);

      // Create a writable stream to pipe to xterm
      const writableStream = new WritableStream({
        write(data) {
          terminalService.write(data);
        }
      });

      // Listen for server output
      process.output.pipeTo(writableStream);

      // Set up error handling for the dev server
      let serverStartTimeout = setTimeout(() => {
        terminalService.write('Server startup is taking longer than expected...', true);
      }, 15000); // 15 seconds timeout

      // Setup server-ready listener
      const serverReadyHandler = (port, url) => {
        clearTimeout(serverStartTimeout);
        terminalService.write(`Server started at ${url}`);

        if (this.onServerStart) {
          this.onServerStart(url);
        }
      };

      // Register the event listener
      const removeListener = webContainerService.on('server-ready', serverReadyHandler);

      // Monitor process exit
      const exitCode = await process.exit;
      clearTimeout(serverStartTimeout);

      // Clean up the event listener
      removeListener();

      if (exitCode !== 0) {
        terminalService.write(`Dev server process exited with code ${exitCode}`, true);
      }
    } catch (error) {
      console.error('Failed to start dev server:', error);
      terminalService.write(`Error starting server: ${error.message}`, true);
    }
  }
}

// Export a singleton instance
const commandService = new CommandService();
export default commandService;
