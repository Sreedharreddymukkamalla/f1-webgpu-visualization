/**
 * Terminal component for displaying console output
 */
export class Terminal {
  private container: HTMLElement;
  private outputElement: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render the terminal HTML
   */
  render(): string {
    return `
      <div class="terminal-container" id="terminal-container">
        <div class="terminal-header">
          <span class="terminal-title">Console Output</span>
          <div class="terminal-controls">
            <span class="terminal-dot"></span>
            <span class="terminal-dot"></span>
            <span class="terminal-dot"></span>
          </div>
        </div>
        <div class="terminal-output" id="terminal-output"></div>
      </div>
    `;
  }

  /**
   * Initialize DOM references after render
   */
  init(): void {
    this.outputElement = this.container.querySelector('#terminal-output');
  }

  /**
   * Add a log message to the terminal
   */
  log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    if (!this.outputElement) {
      this.outputElement = this.container.querySelector('#terminal-output');
    }
    if (!this.outputElement) return;
    
    const logLine = document.createElement('div');
    logLine.className = `terminal-line terminal-${type}`;
    logLine.textContent = message;
    this.outputElement.appendChild(logLine);
    
    // Auto-scroll to bottom
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
    logLine.scrollIntoView({ behavior: 'smooth', block: 'end' });
    
    requestAnimationFrame(() => {
      if (this.outputElement) {
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
      }
    });
  }

  /**
   * Clear all terminal output
   */
  clear(): void {
    if (!this.outputElement) {
      this.outputElement = this.container.querySelector('#terminal-output');
    }
    if (this.outputElement) {
      this.outputElement.innerHTML = '';
    }
  }

  /**
   * Show the terminal
   */
  show(): void {
    const terminalContainer = this.container.querySelector('#terminal-container') as HTMLElement;
    if (terminalContainer) {
      terminalContainer.classList.add('active');
      setTimeout(() => {
        terminalContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }

  /**
   * Setup WebSocket log listener
   */
  setupWebSocketLogListener(): void {
    if ((window as any).wsClient) {
      const wsClient = (window as any).wsClient;
      
      if (wsClient.ws) {
        wsClient.ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
              this.log(data.message, data.level === 'error' ? 'error' : 'info');
            }
          } catch (e) {
            // Ignore parse errors
          }
        });
      }
    }
  }
}
