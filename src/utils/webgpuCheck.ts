import WebGPU from 'three/addons/capabilities/WebGPU.js';

/**
 * Check if WebGPU is available. If not, WebGPURenderer will automatically
 * fall back to WebGL2 — so we only warn rather than throw.
 */
export function checkWebGPUSupport(): void {
  if (!WebGPU.isAvailable()) {

  }
}

