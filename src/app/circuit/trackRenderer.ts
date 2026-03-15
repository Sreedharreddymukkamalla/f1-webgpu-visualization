/**
 * Track Renderer - Renders the circuit track surface, boundaries, and DRS zones
 * Uses telemetry data instead of STL files
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface TrackData {
  centerline: {
    x: number[];
    y: number[];
  };
  boundaries: {
    inner: { x: number[]; y: number[] };
    outer: { x: number[]; y: number[] };
  };
  bounds: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
  };
  drs_zones: Array<{
    start: { x: number; y: number; index: number };
    end: { x: number; y: number; index: number };
  }>;
  track_width: number;
  finish_line?: {
    x: number;
    y: number;
    tangent: { x: number; y: number };
    normal: { x: number; y: number };
  };
  grid_line?: {
    x: number;
    y: number;
    tangent: { x: number; y: number };
    normal: { x: number; y: number };
  };
}

const GRANDSTAND_COUNT = 4;

export class TrackRenderer {
  private scene: THREE.Scene;
  private trackGroup: THREE.Group;
  private gltfLoader: GLTFLoader;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.trackGroup = new THREE.Group();
    this.trackGroup.name = 'track';
    this.scene.add(this.trackGroup);
    this.gltfLoader = new GLTFLoader();
  }

  async loadTrack(trackData: TrackData): Promise<void> {
    this.clear();
    await this.renderTrackSurface(trackData);
    await this.renderBoundaries(trackData.boundaries);
    this.renderDRSZones(trackData);
    await this.renderStadiumGrandstands(trackData);
    
    console.log(`✓ Track rendered: ${trackData.centerline.x.length} points, ${trackData.drs_zones?.length || 0} DRS zones`);
  }

  private async renderTrackSurface(trackData: TrackData): Promise<void> {
    const { inner, outer } = trackData.boundaries;
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const trackThickness = 2.0;

    // Calculate cumulative distance for UV mapping
    const distances: number[] = [0];
    for (let i = 1; i < inner.x.length; i++) {
      const dx = inner.x[i] - inner.x[i - 1];
      const dy = inner.y[i] - inner.y[i - 1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      distances.push(distances[i - 1] + dist);
    }

    let vertexIndex = 0;
    for (let i = 0; i < inner.x.length; i++) {
      // Normalize U coordinate along track (0 to 1, then repeat via texture wrapping)
      const u = distances[i] * 0.002; // Adjust scale for tiling
      
      // Top surface vertices
      vertices.push(inner.x[i], trackThickness, inner.y[i]);
      uvs.push(u, 0); // Inner edge
      
      vertices.push(outer.x[i], trackThickness, outer.y[i]);
      uvs.push(u, 1); // Outer edge
      
      // Bottom surface vertices
      vertices.push(inner.x[i], 0, inner.y[i]);
      uvs.push(u, 0);
      
      vertices.push(outer.x[i], 0, outer.y[i]);
      uvs.push(u, 1);

      if (i < inner.x.length - 1) {
        const base = vertexIndex * 4;
        indices.push(base, base + 4, base + 1);
        indices.push(base + 1, base + 4, base + 5);
        indices.push(base + 2, base + 3, base + 6);
        indices.push(base + 3, base + 7, base + 6);
        indices.push(base, base + 2, base + 4);
        indices.push(base + 2, base + 6, base + 4);
        indices.push(base + 1, base + 5, base + 3);
        indices.push(base + 3, base + 5, base + 7);
      }
      vertexIndex++;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Load asphalt texture asynchronously
    const textureLoader = new THREE.TextureLoader();
    const asphaltTexture = await textureLoader.loadAsync('/images/asphalt.jpg');
    asphaltTexture.wrapS = THREE.RepeatWrapping;
    asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltTexture.colorSpace = THREE.SRGBColorSpace;
    
    console.log('✓ Asphalt texture loaded');

    // Use MeshBasicMaterial (unlit) since scene may lack sufficient lighting
    const material = new THREE.MeshBasicMaterial({
      map: asphaltTexture,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'track-surface';
    mesh.receiveShadow = true;
    this.trackGroup.add(mesh);
  }

  private async renderBoundaries(boundaries: { inner: { x: number[]; y: number[] }; outer: { x: number[]; y: number[] } }): Promise<void> {
    // Load kerb texture once for both boundaries
    const textureLoader = new THREE.TextureLoader();
    const kerbTexture = await textureLoader.loadAsync('/images/kerb.png');
    kerbTexture.wrapS = THREE.RepeatWrapping;
    kerbTexture.wrapT = THREE.RepeatWrapping;
    kerbTexture.colorSpace = THREE.SRGBColorSpace;
    kerbTexture.repeat.set(0.1, 1); // Adjust tiling
    
    // Render inner and outer kerbs
    this.renderBoundaryRibbon(boundaries.inner, kerbTexture, 'inner-boundary', 50, false);
    this.renderBoundaryRibbon(boundaries.outer, kerbTexture, 'outer-boundary', 50, true);
  }

  private renderBoundaryRibbon(boundary: { x: number[]; y: number[] }, texture: THREE.Texture, name: string, width: number, isOuter: boolean): void {
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    // Sample points for ribbon
    const step = Math.max(1, Math.floor(boundary.x.length / 500));
    const sampledPoints: { x: number; y: number }[] = [];
    
    for (let i = 0; i < boundary.x.length; i += step) {
      sampledPoints.push({ x: boundary.x[i], y: boundary.y[i] });
    }
    // Ensure we include the last point
    const lastIdx = boundary.x.length - 1;
    sampledPoints.push({ x: boundary.x[lastIdx], y: boundary.y[lastIdx] });

    if (sampledPoints.length < 2) return;

    let cumulativeDistance = 0;
    
    for (let i = 0; i < sampledPoints.length; i++) {
      const curr = sampledPoints[i];
      const prev = i > 0 ? sampledPoints[i - 1] : curr;
      const next = i < sampledPoints.length - 1 ? sampledPoints[i + 1] : curr;
      
      // Calculate perpendicular direction for ribbon width
      const tangentX = next.x - prev.x;
      const tangentY = next.y - prev.y;
      const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
      const perpX = -tangentY / len;
      const perpY = tangentX / len;
      
      // Calculate distance for UV
      if (i > 0) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        cumulativeDistance += Math.sqrt(dx * dx + dy * dy);
      }
      const v = cumulativeDistance * 0.02; // UV tiling along track for stripes
      
      // Inner edge of ribbon (at boundary)
      vertices.push(curr.x, 3.0, curr.y);
      uvs.push(0, v); // U=0 (inner), V=distance (for stripe repetition)
      
      // Outer edge of ribbon (offset outward from track)
      const offsetDir = isOuter ? 1 : -1;
      vertices.push(curr.x + perpX * width * offsetDir, 3.0, curr.y + perpY * width * offsetDir);
      uvs.push(1, v); // U=1 (outer), V=distance (for stripe repetition)
      
      // Create triangles
      if (i > 0) {
        const base = (i - 1) * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    this.trackGroup.add(mesh);
  }

  private renderDRSZones(trackData: TrackData): void {
    // Render DRS zones as bright green flat ribbons on OUTER track edge
    if (!trackData.drs_zones || trackData.drs_zones.length === 0) {
      return;
    }

    const outer = trackData.boundaries.outer;
    const drsWidth = 40; // Width of DRS ribbon
    const drsMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, // Bright green
      side: THREE.DoubleSide,
    });

    trackData.drs_zones.forEach((zone, index) => {
      const startIdx = zone.start.index;
      const endIdx = zone.end.index;

      const vertices: number[] = [];
      const indices: number[] = [];
      
      // Sample points along the DRS zone
      const step = Math.max(1, Math.floor((endIdx - startIdx) / 100));
      const sampledPoints: { x: number; y: number; idx: number }[] = [];
      
      for (let i = startIdx; i <= Math.min(endIdx, outer.x.length - 1); i += step) {
        sampledPoints.push({ x: outer.x[i], y: outer.y[i], idx: i });
      }
      if (endIdx < outer.x.length) {
        sampledPoints.push({ x: outer.x[endIdx], y: outer.y[endIdx], idx: endIdx });
      }

      if (sampledPoints.length < 2) return;

      for (let i = 0; i < sampledPoints.length; i++) {
        const curr = sampledPoints[i];
        const prev = i > 0 ? sampledPoints[i - 1] : curr;
        const next = i < sampledPoints.length - 1 ? sampledPoints[i + 1] : curr;
        
        // Calculate perpendicular direction
        const tangentX = next.x - prev.x;
        const tangentY = next.y - prev.y;
        const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
        const perpX = -tangentY / len;
        const perpY = tangentX / len;
        
        // Inner edge (at boundary)
        vertices.push(curr.x, 4.0, curr.y);
        // Outer edge (offset outward)
        vertices.push(curr.x + perpX * drsWidth, 4.0, curr.y + perpY * drsWidth);
        
        // Create triangles
        if (i > 0) {
          const base = (i - 1) * 2;
          indices.push(base, base + 2, base + 1);
          indices.push(base + 1, base + 2, base + 3);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(geometry, drsMaterial);
      mesh.name = `drs-zone-${index}`;
      this.trackGroup.add(mesh);
    });

    console.log(`✓ Rendered ${trackData.drs_zones.length} DRS zones (green flat ribbons)`);
  }


  private async renderStadiumGrandstands(trackData: TrackData): Promise<void> {
    const outer = trackData.boundaries.outer;
    const n = outer.x.length;
    if (n < 2) return;

    let gltf: any;
    try {
      gltf = await new Promise<any>((resolve, reject) => {
        this.gltfLoader.load('/files/Stadium.glb', resolve, undefined, reject);
      });
    } catch (err) {
      console.warn('Stadium.glb could not be loaded:', err);
      return;
    }

    // Compute the centroid of the outer boundary for reliable outward direction
    let cx = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      cx += outer.x[i];
      cz += outer.y[i];
    }
    cx /= n;
    cz /= n;

    // Track width drives standoff & scale so grandstands fit at any track scale
    const tw = trackData.track_width || 15;
    const standoffDistance = tw * 8;
    const modelScale = tw * 1.5;

    // Place GRANDSTAND_COUNT grandstands evenly around the outer boundary
    for (let g = 0; g < GRANDSTAND_COUNT; g++) {
      const idx = Math.floor((g / GRANDSTAND_COUNT) * n);

      // Outward direction: centroid → boundary point (always correct regardless of winding)
      const dx = outer.x[idx] - cx;
      const dz = outer.y[idx] - cz;
      const dLen = Math.sqrt(dx * dx + dz * dz) || 1;
      const outX = dx / dLen;
      const outZ = dz / dLen;

      const posX = outer.x[idx] + outX * standoffDistance;
      const posZ = outer.y[idx] + outZ * standoffDistance;

      // Deep-clone the scene and ensure all child materials are cloned too
      const stand = gltf.scene.clone(true);
      stand.name = `stadium-grandstand-${g}`;
      stand.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // Clone material so each instance is independent
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => m.clone());
          } else if (mesh.material) {
            mesh.material = (mesh.material as THREE.Material).clone();
          }
        }
      });

      stand.scale.set(modelScale, modelScale, modelScale);
      stand.position.set(posX, 0, posZ);

      // Rotate so the grandstand faces inward toward the track centroid
      const angle = Math.atan2(-outX, -outZ);
      stand.rotation.y = angle;

      this.trackGroup.add(stand);
    }

    console.log(`✓ Placed ${GRANDSTAND_COUNT} stadium grandstands around the track (scale=${modelScale.toFixed(1)}, standoff=${standoffDistance.toFixed(1)})`);
  }

  getBounds(): { min: THREE.Vector3; max: THREE.Vector3 } | null {
    const box = new THREE.Box3().setFromObject(this.trackGroup);
    if (box.isEmpty()) return null;
    return { min: box.min, max: box.max };
  }

  clear(): void {
    while (this.trackGroup.children.length > 0) {
      const child = this.trackGroup.children[0];
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
      this.trackGroup.remove(child);
    }
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.trackGroup);
  }
}
