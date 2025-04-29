/**
 * Service for UI operations
 */
class UIService {
  constructor() {
    this.statusElement = null;
    this.consoleOutput = null;
    this.iframeElement = null;
  }

  /**
   * Initialize UI elements
   * @param {Object} elements UI elements
   */
  initialize(elements) {
    const { statusElement, consoleOutput, iframeElement } = elements;

    this.statusElement = statusElement;
    this.consoleOutput = consoleOutput;
    this.iframeElement = iframeElement;
  }

  /**
   * Update status message
   * @param {string} message Status message
   */
  updateStatus(message) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
    }
  }

  /**
   * Write to console output
   * @param {string} text Text to write
   * @param {boolean} isError Whether it's an error message
   */
  writeToConsole(text, isError = false) {
    if (!this.consoleOutput) return;

    const line = document.createElement('div');
    line.textContent = text;

    if (isError) {
      line.style.color = '#e74c3c';
    }

    this.consoleOutput.appendChild(line);
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }

  /**
   * Update iframe URL
   * @param {string} url New URL
   */
  updateIframeUrl(url) {
    if (this.iframeElement) {
      this.iframeElement.src = url;
    }
  }

  /**
   * Clear console output
   */
  clearConsole() {
    if (this.consoleOutput) {
      this.consoleOutput.innerHTML = '';
    }
  }

  /**
   * Reset iframe to loading state
   */
  resetIframe() {
    if (this.iframeElement) {
      this.iframeElement.src = 'loading.html';
    }
  }
}

// Export a singleton instance
const uiService = new UIService();
export default uiService;
