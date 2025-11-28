import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { RiverSystem } from './RiverSystem';
import { Decorations } from './Decorations';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class TerrainChunk {
  mesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  decorations: THREE.Group;

  // Config
  public static readonly CHUNK_SIZE = 62.5; // Size of chunk in Z (Reduced to 62.5 for incremental generation)
  public static readonly CHUNK_WIDTH = 400; // Width of world in X
  public static readonly RESOLUTION_X = 160; // Vertices along X
  public static readonly RESOLUTION_Z = 25; // Vertices along Z (Reduced to 25)

  private static biomeNoise = new SimplexNoise(200);

  public static getBiomeFactor(z: number): number {
    // Biome Selection (Z-dependent only)
    // 50/50 split with rapid transition
    // Use low frequency noise for biome patches
    let biomeNoise = this.biomeNoise.noise2D(100, z * 0.001); // Offset X by 100 to avoid 0.0 at origin

    // Helper for smoothstep
    const smoothstep = (min: number, max: number, value: number): number => {
      const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return x * x * (3 - 2 * x);
    };

    // biomeNoise is -1 to 1.
    // We want rapid transition around 0.
    // Sigmoid-like transition: smoothstep around -0.1 to 0.1
    // 0 = Desert, 1 = Forest
    return smoothstep(-0.2, 0.2, biomeNoise);
  }

  zOffset: number;
  private noise: SimplexNoise;
  private riverSystem: RiverSystem;
  private graphicsEngine: GraphicsEngine;

  constructor(
    zOffset: number,
    graphicsEngine: GraphicsEngine
  ) {
    this.zOffset = zOffset;
    this.graphicsEngine = graphicsEngine;
    this.noise = new SimplexNoise(200);
    this.riverSystem = RiverSystem.getInstance();

    this.mesh = this.generateMesh();
    this.waterMesh = this.generateWater();
    this.decorations = this.generateDecorations();

    this.graphicsEngine.add(this.mesh);
    this.graphicsEngine.add(this.waterMesh);
    this.graphicsEngine.add(this.decorations);
  }

  private generateMesh(): THREE.Mesh {
    const chunkSize = TerrainChunk.CHUNK_SIZE;
    const chunkWidth = TerrainChunk.CHUNK_WIDTH;
    const resX = TerrainChunk.RESOLUTION_X;
    const resZ = TerrainChunk.RESOLUTION_Z;

    const numVertices = (resX + 1) * (resZ + 1);
    const numIndices = resX * resZ * 6;

    const positions = new Float32Array(numVertices * 3);
    const colors = new Float32Array(numVertices * 3);
    const uvs = new Float32Array(numVertices * 2);
    const indices = new Uint32Array(numIndices);

    const colorDry = { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 }; // Ochre Yellow (Desert)
    const colorWet = { r: 0x1A / 255, g: 0x33 / 255, b: 0x1A / 255 }; // Dark Green (Forest)

    // Helper for distribution
    const getDistributedX = (u: number, width: number): number => {
      const C = width / 4;
      return C * u * (1 + (u * u));
    };

    // Generate Vertices
    for (let z = 0; z <= resZ; z++) {
      const v = z / resZ;
      const localZ = v * chunkSize;
      const worldZ = this.zOffset + localZ;

      const biomeFactor = TerrainChunk.getBiomeFactor(worldZ);

      for (let x = 0; x <= resX; x++) {
        const u = (x / resX) * 2 - 1;
        const localX = getDistributedX(u, chunkWidth);

        const index = z * (resX + 1) + x;

        const riverCenter = this.riverSystem.getRiverCenter(worldZ);
        const worldX = localX + riverCenter;
        const height = this.calculateHeight(localX, worldZ);

        positions[index * 3] = worldX;
        positions[index * 3 + 1] = height;
        positions[index * 3 + 2] = localZ;

        // Colors
        // Purely biome based, maybe slight noise variation but mostly solid
        // Lerp between Desert and Forest based on biomeFactor

        colors[index * 3] = colorDry.r * (1 - biomeFactor) + colorWet.r * biomeFactor;
        colors[index * 3 + 1] = colorDry.g * (1 - biomeFactor) + colorWet.g * biomeFactor;
        colors[index * 3 + 2] = colorDry.b * (1 - biomeFactor) + colorWet.b * biomeFactor;

        // UVs
        uvs[index * 2] = (localX / chunkWidth) + 0.5;
        uvs[index * 2 + 1] = v;
      }
    }

    // Generate Indices
    let i = 0;
    for (let z = 0; z < resZ; z++) {
      for (let x = 0; x < resX; x++) {
        const a = z * (resX + 1) + x;
        const b = (z + 1) * (resX + 1) + x;
        const c = (z + 1) * (resX + 1) + (x + 1);
        const d = z * (resX + 1) + (x + 1);

        indices[i++] = a;
        indices[i++] = b;
        indices[i++] = d;
        indices[i++] = b;
        indices[i++] = c;
        indices[i++] = d;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    geometry.computeVertexNormals();

    // Create custom gradient for toon shading
    const gradientColors = new Uint8Array([
      50, 50, 50, 255,
      100, 100, 100, 255,
      255, 255, 255, 255
    ]);
    const gradientMap = new THREE.DataTexture(gradientColors, 3, 1, THREE.RGBAFormat);
    gradientMap.needsUpdate = true;
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: gradientMap,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, this.zOffset);

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    return mesh;
  }

  private generateDecorations(): THREE.Group {
    const group = new THREE.Group();
    const count = 1000; // Increased to 5x density

    // Buckets for geometry merging
    const geometriesByMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

    for (let i = 0; i < count; i++) {
      // ... (Random position logic same as before) ...
      const localZ = Math.random() * TerrainChunk.CHUNK_SIZE;
      const worldZ = this.zOffset + localZ;
      const u = Math.random() * 2 - 1;
      const localX = u * (TerrainChunk.CHUNK_WIDTH / 2);
      const riverCenter = this.riverSystem.getRiverCenter(worldZ);
      const worldX = localX + riverCenter;
      const height = this.calculateHeight(localX, worldZ);
      const riverWidth = this.riverSystem.getRiverWidth(worldZ);
      const distFromCenter = Math.abs(localX);
      const distFromBank = distFromCenter - riverWidth / 2;
      const biasDistance = 80;
      if (distFromBank > 0) {
        const normalizedDist = Math.min(1.0, distFromBank / biasDistance);
        const probability = Math.pow(1.0 - normalizedDist, 2);
        if (Math.random() > probability) continue;
      }
      if (height < 2.0) continue;
      if (!this.checkVisibility(localX, height, worldZ)) continue;

      // Biome Logic (Same as generateMesh)
      const biomeFactor = TerrainChunk.getBiomeFactor(worldZ);

      let object: THREE.Object3D | null = null;

      // biomeFactor: 0 = Desert, 1 = Forest
      if (biomeFactor < 0.5) {
        // Desert
        if (Math.random() > 0.8) object = Decorations.getCactus();
      } else {
        // Forest
        if (Math.random() > 0.8) object = Decorations.getTree(biomeFactor);
      }

      if (object) {
        object.position.set(worldX, height, worldZ);
        object.rotation.y = Math.random() * Math.PI * 2;
        object.updateMatrixWorld(true); // Ensure matrix is up to date

        // Traverse and collect geometries
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const geometry = child.geometry.clone();
            geometry.applyMatrix4(child.matrixWorld);

            // Reset position/rotation/scale since we applied it to geometry
            // Actually we just want the raw geometry transformed into world space (relative to chunk?)
            // Wait, the chunk itself is at (0,0,0) but its content is at world coords?
            // No, TerrainChunk.mesh is at (0,0, zOffset).
            // But my worker generated positions at worldX, height, localZ.
            // And I set mesh.position.z = zOffset.
            // So localZ + zOffset = worldZ.

            // Here, object.position is (worldX, height, worldZ).
            // If I add this to the chunk group, and the chunk group is at (0,0,0)?
            // TerrainChunk.decorations is added to graphicsEngine directly?
            // Yes: this.graphicsEngine.add(this.decorations);
            // So decorations should be in world coordinates.

            // So applying matrixWorld (which includes object position) is correct.

            let material = child.material as THREE.Material;
            if (!geometriesByMaterial.has(material)) {
              geometriesByMaterial.set(material, []);
            }
            geometriesByMaterial.get(material)!.push(geometry);
          }
        });
      }
    }

    // Merge and create meshes
    for (const [material, geometries] of geometriesByMaterial) {
      if (geometries.length === 0) continue;
      const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
      const mesh = new THREE.Mesh(mergedGeometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  dispose() {
    this.graphicsEngine.remove(this.mesh);
    this.graphicsEngine.remove(this.waterMesh);
    this.graphicsEngine.remove(this.decorations);

    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    } else {
      this.mesh.material.dispose();
    }

    this.waterMesh.geometry.dispose();
    if (Array.isArray(this.waterMesh.material)) {
      this.waterMesh.material.forEach(m => m.dispose());
    } else {
      this.waterMesh.material.dispose();
    }

    this.graphicsEngine.remove(this.decorations);
    // Dispose children materials/geometries if needed
    // Since we reuse static materials in Decorations, we might not want to dispose them?
    // Actually Decorations uses static materials, so we shouldn't dispose them here.
    // Just remove from scene and clear children.
    this.decorations.clear();
  }

  private generateWater(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      TerrainChunk.CHUNK_WIDTH,
      TerrainChunk.CHUNK_SIZE,
      TerrainChunk.RESOLUTION_X - 1,
      TerrainChunk.RESOLUTION_Z - 1
    );
    geometry.rotateX(-Math.PI / 2);

    // Shift Z to be 0 to CHUNK_SIZE (PlaneGeometry is centered)
    geometry.translate(0, 0, TerrainChunk.CHUNK_SIZE / 2);

    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i);
      const worldZ = this.zOffset + localZ;

      const riverCenter = this.riverSystem.getRiverCenter(worldZ);
      positions.setX(i, localX + riverCenter);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshToonMaterial({
      color: 0x4da6ff,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, this.zOffset);

    return mesh;
  }

  private checkVisibility(targetLocalX: number, targetHeight: number, worldZ: number): boolean {
    // Ray start: River center (localX = 0), slightly above water (y = 2)
    const startX = 0;
    const startY = 2;

    const endX = targetLocalX;
    const endY = targetHeight;

    const steps = 4; // Number of checks along the ray

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = startX + (endX - startX) * t;
      const checkY = startY + (endY - startY) * t;

      // Sample terrain height at this point
      // We need worldZ for calculateHeight, which is constant along this cross-section ray
      // (Assuming we are checking visibility roughly perpendicular to river, which is true for localX)
      // Actually, calculateHeight takes localX and worldZ.
      const terrainHeight = this.calculateHeight(checkX, worldZ);

      // If terrain is significantly higher than ray point, it's occluded
      if (terrainHeight > checkY + 0.5) { // 0.5 buffer
        return false;
      }
    }

    return true;
  }

  private calculateNormal(x: number, z: number): THREE.Vector3 {
    const epsilon = 0.1;

    const hL = this.calculateHeight(x - epsilon, z);
    const hR = this.calculateHeight(x + epsilon, z);
    const hD = this.calculateHeight(x, z - epsilon);
    const hU = this.calculateHeight(x, z + epsilon);

    // Normal vector: cross product of tangent vectors
    const v1 = new THREE.Vector3(2 * epsilon, hR - hL, 0);
    const v2 = new THREE.Vector3(0, hU - hD, 2 * epsilon);

    const normal = new THREE.Vector3().crossVectors(v2, v1).normalize();
    return normal;
  }

  private calculateHeight(x: number, z: number): number {
    // x is distance from river center (localX)

    const riverWidth = this.riverSystem.getRiverWidth(z);
    const riverEdge = riverWidth / 2;
    const distFromCenter = Math.abs(x);
    const distFromBank = distFromCenter - riverEdge;

    // 1. Land Generation (Base Terrain)
    // "Mountainous" Map: Low frequency noise to determine biome
    let mountainMask = this.noise.noise2D(x * 0.001, z * 0.001);
    mountainMask = (mountainMask + 1) / 2; // Normalize to 0-1
    mountainMask = Math.pow(mountainMask, 2); // Bias towards 0 (more hills than mountains)

    // Rolling Hills (Low Amplitude, Smooth)
    const hillNoise =
      this.noise.noise2D(x * 0.01, z * 0.01) * 5 +
      this.noise.noise2D(x * 0.03, z * 0.03) * 2;

    // Rugged Mountains (High Amplitude, Ridged)
    const ridge1 = 1 - Math.abs(this.noise.noise2D(x * 0.005, z * 0.005));
    const ridge2 = 1 - Math.abs(this.noise.noise2D(x * 0.01, z * 0.01));
    const mountainNoise = (Math.pow(ridge1, 2) * 40 + Math.pow(ridge2, 2) * 10);

    // Blend based on mask
    let rawLandHeight = (hillNoise * (1 - mountainMask)) + (mountainNoise * mountainMask);

    // Add detail noise everywhere
    rawLandHeight += this.noise.noise2D(x * 0.1, z * 0.1) * 1.0;

    // FIX: Clamp land height to be strictly above water level to prevent inland lakes
    // We add a base height (e.g. 2.0) and clamp
    rawLandHeight = Math.max(2.0, rawLandHeight + 2.0);

    // Apply Bank Taper: Force land height to 0 at the river edge
    // Smoothly ramp up over 15 units
    const bankTaper = this.smoothstep(0, 15, distFromBank);
    const landHeight = rawLandHeight * bankTaper;

    // 2. River Bed Generation
    const depth = 8; // Deeper river
    // Parabolic profile: 1 at center, 0 at edge
    const normalizedX = Math.min(1.0, distFromCenter / riverEdge);
    const riverBedHeight = -depth * (1 - normalizedX * normalizedX);

    // 3. Blend Land and River
    // We blend over a small zone around the edge to avoid hard creases
    const transitionWidth = 8.0; // Slightly wider transition for smoother visuals
    const mixFactor = this.smoothstep(riverEdge - transitionWidth / 2, riverEdge + transitionWidth / 2, distFromCenter);

    // mixFactor is 0 inside river (bed), 1 outside (land)
    return (1 - mixFactor) * riverBedHeight + mixFactor * landHeight;
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}
