import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import webContainerService from './WebContainerService';

/**
 * Service for managing terminal operations
 */
class TerminalService {
  constructor() {
    this.terminal = null;
    this.fitAddon = null;
    this.container = null;
    this.commandCallback = null;
  }

  /**
   * Initialize the terminal
   * @param {HTMLElement} container Container element
   * @param {Function} commandCallback Callback for command execution
   */
  initialize(container, commandCallback) {
    this.container = container;
    this.commandCallback = commandCallback;

    // Create new terminal
    this.terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4'
      },
      fontSize: 14,
      allowProposedApi: true
    });

    // Create and load FitAddon
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Open the terminal in the container element
    this.terminal.open(container);

    // Add window resize handler
    this.setupResizeHandler();

    // Setup input handling
    this.setupInputHandling();

    return this.terminal;
  }

  /**
   * Set up terminal resize handler
   */
  setupResizeHandler() {
    // Make terminal fit available space
    setTimeout(() => {
      try {
        this.fitAddon.fit();
      } catch (err) {
        console.error('Error fitting terminal:', err);
      }
    }, 100);

    // Fit terminal on window resize
    window.addEventListener('resize', () => {
      try {
        this.fitAddon.fit();
      } catch (err) {
        console.error('Error fitting terminal on resize:', err);
      }
    });
  }

  /**
   * Set up input handling for the terminal
   */
  setupInputHandling() {
    if (!this.terminal) return;

    // Set the prompt
    const prompt = '$ ';
    let command = '';

    // Write initial prompt
    this.terminal.write(prompt);

    // Handle terminal input
    this.terminal.onKey(async ({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

      if (domEvent.keyCode === 13) { // Enter key
        // Process the command
        this.terminal.write('\r\n');
        if (command.trim().length > 0 && this.commandCallback) {
          try {
            await this.commandCallback(command);
          } catch (error) {
            this.terminal.write(`\r\nError: ${error.message}\r\n`);
          }
        }
        // Reset command and show a new prompt
        command = '';
        this.terminal.write('\r\n' + prompt);
      } else if (domEvent.keyCode === 8) { // Backspace
        // Don't delete the prompt
        if (command.length > 0) {
          command = command.slice(0, -1);
          this.terminal.write('\b \b');
        }
      } else if (printable) {
        command += key;
        this.terminal.write(key);
      }
    });
  }

  /**
   * Write text to the terminal
   * @param {string} text Text to write
   * @param {boolean} isError Whether it's an error message
   */
  write(text, isError = false) {
    if (!this.terminal) return;

    // If text doesn't end with \r\n, add it to ensure proper line breaks
    if (!text.endsWith('\r\n') && !text.endsWith('\n')) {
      text += '\r\n';
    }

    // Apply error styling if needed
    if (isError) {
      this.terminal.write('\x1b[31m' + text + '\x1b[0m');
    } else {
      this.terminal.write(text);
    }
  }

  /**
   * Clear the terminal
   */
  clear() {
    if (this.terminal) {
      this.terminal.clear();
      this.terminal.write('$ ');
    }
  }
}

// Export a singleton instance
const terminalService = new TerminalService();
export default terminalService;
