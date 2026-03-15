import type { TelemetryFrame } from '../playback/websocketClient';
import { getDriverName } from './TeamMapping.js';
import '../../styles/povOverlay.css';

export class POVOverlay {
  private container: HTMLElement;
  private overlayEl: HTMLElement | null = null;
  private currentDriverCode: string | null = null;
  
  // Elements
  private gearNodes: HTMLElement[] = [];
  private speedKmhEl: HTMLElement | null = null;
  private speedMphEl: HTMLElement | null = null;
  private throttleSegments: HTMLElement[] = [];
  private brakeSegments: HTMLElement[] = [];
  private drsBadgeEl: HTMLElement | null = null;
  private rpmFillEl: HTMLElement | null = null;
  private driverNameEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    const hud = document.createElement('div');
    hud.className = 'pov-hud';
    hud.innerHTML = `
      <div class="hud-layout-grid">
        <!-- Throttle Side (Left) -->
        <div class="side-input left">
          <div class="input-label-pro">THROTTLE</div>
          <div class="segments-pro" id="thr-segs-pro">
            ${Array(24).fill('<div class="seg-pro throttle"></div>').join('')}
          </div>
        </div>

        <!-- Center Cluster (Speed & Gear) -->
        <div class="central-cluster-pro">
          <div id="hud-drs-badge" class="drs-badge-pro">DRS</div>
          
          <div class="speed-row-pro">
            <div class="speed-group-pro">
              <div id="kmh-val-pro" class="val-kmh-pro">0</div>
              <div class="unit-label-pro">KM/H</div>
            </div>
            <div class="speed-group-pro">
              <div id="mph-val-pro" class="val-mph-pro">0</div>
              <div class="unit-label-pro">MPH</div>
            </div>
          </div>

          <div class="gear-row-pro">
            <span class="gear-st-pro" data-gear="N">N</span>
            <span class="gear-st-pro" data-gear="1">1</span>
            <span class="gear-st-pro" data-gear="2">2</span>
            <span class="gear-st-pro" data-gear="3">3</span>
            <span class="gear-st-pro" data-gear="4">4</span>
            <span class="gear-st-pro" data-gear="5">5</span>
            <span class="gear-st-pro" data-gear="6">6</span>
            <span class="gear-st-pro" data-gear="7">7</span>
            <span class="gear-st-pro" data-gear="8">8</span>
          </div>

          <div class="rpm-container-pro">
            <div id="rpm-fill-pro" class="rpm-fill-pro"></div>
          </div>
        </div>

        <!-- Brake Side (Right) -->
        <div class="side-input right">
          <div class="input-label-pro">BRAKE</div>
          <div class="segments-pro" id="brk-segs-pro">
            ${Array(24).fill('<div class="seg-pro brake"></div>').join('')}
          </div>
        </div>
      </div>

      </div>
    `;
    
    this.container.appendChild(hud);
    this.overlayEl = hud;
    
    // Cache
    this.speedKmhEl = hud.querySelector('#kmh-val-pro');
    this.speedMphEl = hud.querySelector('#mph-val-pro');
    this.gearNodes = Array.from(hud.querySelectorAll('.gear-st-pro'));
    this.throttleSegments = Array.from(hud.querySelectorAll('#thr-segs-pro .seg-pro'));
    this.brakeSegments = Array.from(hud.querySelectorAll('#brk-segs-pro .seg-pro'));
    this.drsBadgeEl = hud.querySelector('#hud-drs-badge');
    this.rpmFillEl = hud.querySelector('#rpm-fill-pro');
    this.driverNameEl = hud.querySelector('#dr-name-pro');
  }

  show(driverCode: string): void {
    this.currentDriverCode = driverCode;
    if (this.overlayEl) {
      this.overlayEl.classList.add('active');
    }
    if (this.driverNameEl) {
      this.driverNameEl.textContent = getDriverName(driverCode).toUpperCase();
    }
  }

  hide(): void {
    this.currentDriverCode = null;
    if (this.overlayEl) {
      this.overlayEl.classList.remove('active');
    }
  }

  update(frame: TelemetryFrame): void {
    if (!this.currentDriverCode || !this.overlayEl?.classList.contains('active')) {
      // console.log('🖥️ POVOverlay: Update skipped - inactive');
      return;
    }
    
    const d = frame.drivers[this.currentDriverCode];
    if (!d) {
      return;
    }
    
    // 1. Speeds
    if (this.speedKmhEl) this.speedKmhEl.textContent = Math.floor(d.speed).toString();
    if (this.speedMphEl) this.speedMphEl.textContent = Math.floor(d.speed * 0.621).toString();
    
    // 2. Gears
    const curGearStr = d.gear === 0 ? 'N' : d.gear.toString();
    this.gearNodes.forEach((node) => {
        const nodeGear = node.dataset.gear;
        node.classList.remove('active', 'neighbor');
        if (nodeGear === curGearStr) {
            node.classList.add('active');
        } else {
            const gearVal = nodeGear === 'N' ? 0 : parseInt(nodeGear || '0');
            if (Math.abs(gearVal - d.gear) === 1) node.classList.add('neighbor');
        }
    });
    
    // 3. Throttle
    const tCount = Math.round((d.throttle / 100) * this.throttleSegments.length);
    this.throttleSegments.forEach((s, i) => {
        if (i < tCount) s.classList.add('active');
        else s.classList.remove('active');
    });

    // 4. Brake
    const bPerc = d.brake > 1 ? d.brake : (d.brake * 100);
    const bCount = Math.round((bPerc / 100) * this.brakeSegments.length);
    this.brakeSegments.forEach((s, i) => {
        if (i < bCount) s.classList.add('active');
        else s.classList.remove('active');
    });

    // 5. DRS
    if (this.drsBadgeEl) {
        if (d.drs >= 10) this.drsBadgeEl.classList.add('active');
        else this.drsBadgeEl.classList.remove('active');
    }

    // 6. RPM
    if (this.rpmFillEl) {
        const perc = Math.min((d.rpm / 12500) * 100, 100);
        this.rpmFillEl.style.width = `${perc}%`;
        if (d.rpm > 11500) this.rpmFillEl.style.filter = 'brightness(2) contrast(1.5)';
        else this.rpmFillEl.style.filter = 'none';
    }

    // 7. Shake Effect
    const cluster = this.overlayEl.querySelector('.central-cluster-pro');
    if (cluster) {
        if (d.speed > 260) cluster.classList.add('shake-active');
        else cluster.classList.remove('shake-active');
    }
  }
}
