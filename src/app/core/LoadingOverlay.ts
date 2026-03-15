/**
 * LoadingOverlay component for displaying loading progress during initialization
 */
export class LoadingOverlay {
  private element: HTMLDivElement;
  private textElement: HTMLElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'model-loading-overlay';
    this.element.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Initializing 3D engine...</div>
      </div>
    `;
    this.element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.5s ease;
    `;
    
    const styles = `
      <style>
        #model-loading-overlay .loading-content {
          text-align: center;
          color: white;
        }
        #model-loading-overlay .loading-spinner {
          width: 60px;
          height: 60px;
          margin: 0 auto 20px;
          border: 4px solid rgba(255, 255, 255, 0.2);
          border-top-color: #e10600;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        #model-loading-overlay .loading-text {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 1px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    this.element.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Show the loading overlay
   */
  show(): void {
    document.body.appendChild(this.element);
    this.textElement = this.element.querySelector('.loading-text');
  }

  /**
   * Update the loading text
   */
  setText(text: string): void {
    if (this.textElement) {
      this.textElement.textContent = text;
    }
  }

  /**
   * Hide and remove the loading overlay with fade animation
   */
  hide(): void {
    this.element.style.opacity = '0';
    setTimeout(() => this.element.remove(), 500);
  }
}
