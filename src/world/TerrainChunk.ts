import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { RiverSystem } from './RiverSystem';
import { Decorations } from './Decorations';

export class TerrainChunk {
  mesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  decorations: THREE.Group;

  // Config
  public static readonly CHUNK_SIZE = 125; // Size of chunk in Z (Reduced to 125 for incremental generation)
  private static readonly CHUNK_WIDTH = 400; // Width of world in X
  private static readonly RESOLUTION_X = 160; // Vertices along X
  private static readonly RESOLUTION_Z = 50; // Vertices along Z (Reduced to 50)

  zOffset: number;
  private noise: SimplexNoise;
  private riverSystem: RiverSystem;

  constructor(
    zOffset: number,
    private graphicsEngine: GraphicsEngine,
  ) {
    this.zOffset = zOffset;
    this.noise = new SimplexNoise(200);
    this.riverSystem = RiverSystem.getInstance();

    this.mesh = this.generateMesh();
    this.waterMesh = this.generateWater();
    this.decorations = this.generateDecorations();

    this.graphicsEngine.add(this.mesh);
    this.graphicsEngine.add(this.waterMesh);
    this.graphicsEngine.add(this.decorations);
  }

  private generateDecorations(): THREE.Group {
    const group = new THREE.Group();
    const count = 1000; // Increased to 5x density

    for (let i = 0; i < count; i++) {
      // Random position in chunk local space
      const localZ = Math.random() * TerrainChunk.CHUNK_SIZE;
      const worldZ = this.zOffset + localZ;

      // Random X across width
      const u = Math.random() * 2 - 1; // -1 to 1
      const localX = u * (TerrainChunk.CHUNK_WIDTH / 2);

      const riverCenter = this.riverSystem.getRiverCenter(worldZ);
      const worldX = localX + riverCenter;

      // Check height and river proximity
      const height = this.calculateHeight(localX, worldZ);
      const riverWidth = this.riverSystem.getRiverWidth(worldZ);

      // Bias towards river
      const distFromCenter = Math.abs(localX);
      const distFromBank = distFromCenter - riverWidth / 2;

      // If inside river (negative distFromBank), we skip anyway via height check.
      // If on land, we want higher probability near bank.
      const biasDistance = 80; // Tighter bias distance
      if (distFromBank > 0) {
        // Exponential drop-off
        const normalizedDist = Math.min(1.0, distFromBank / biasDistance);
        const probability = Math.pow(1.0 - normalizedDist, 2); // Quadratic falloff

        if (Math.random() > probability) continue;
      } else {
        // Inside river width (but might be on bank due to height check)
        // Keep it.
      }

      // Only spawn on land (height > water level + buffer)
      if (height < 2.0) continue; // Water is at 0, river bed is negative. Land starts > 0.

      // Visibility Check: Raycast from river center to spawn point
      if (!this.checkVisibility(localX, height, worldZ)) continue;

      // Calculate Wetness (Same as mesh)
      let wetness = this.noise.noise2D(worldX * 0.002, worldZ * 0.002);
      wetness = (wetness + 1) / 2;

      let object: THREE.Object3D | null = null;

      if (wetness < 0.4) {
        // Dry: Cactus or Dry Bush
        if (Math.random() > 0.6) {
          object = Decorations.getCactus();
        } else {
          object = Decorations.getBush(wetness);
        }
      } else if (wetness > 0.6) {
        // Wet: Tree or Green Bush
        if (Math.random() > 0.7) {
          object = Decorations.getTree(wetness);
        } else {
          object = Decorations.getBush(wetness);
        }
      } else {
        // Transition: Mix
        if (Math.random() > 0.5) {
          object = Decorations.getTree(wetness);
        } else {
          object = Decorations.getBush(wetness);
        }
      }

      if (object) {
        object.position.set(worldX, height, worldZ);
        // Random rotation
        object.rotation.y = Math.random() * Math.PI * 2;
        group.add(object);
      }
    }
    return group;
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

  private getDistributedX(u: number): number {
    // u is normalized from -1 to 1
    // We want higher density near 0, lower near +/- 1
    // Mapping function: x(u) = C * u * (1 + u^2)
    // This gives a slope ratio of 4:1 between edge and center

    // Calculate C such that x(1) = halfWidth
    // x(1) = C * 1 * (2) = 2C
    // 2C = halfWidth => C = halfWidth / 2 = width / 4

    const width = TerrainChunk.CHUNK_WIDTH;
    const C = width / 4;

    return C * u * (1 + (u * u));
  }

  private createCustomGridGeometry(): THREE.BufferGeometry {
    const resX = TerrainChunk.RESOLUTION_X;
    const resZ = TerrainChunk.RESOLUTION_Z;
    const numVertices = (resX + 1) * (resZ + 1);
    const numIndices = resX * resZ * 6;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    const uvs = new Float32Array(numVertices * 2);
    const indices = [];

    // Generate Vertices
    for (let z = 0; z <= resZ; z++) {
      const v = z / resZ;
      // Z runs from +Size/2 to -Size/2 to match PlaneGeometry orientation if needed
      // But let's stick to our world coordinates: 0 to CHUNK_SIZE
      // Actually generateMesh used: (zOffset + CHUNK_SIZE/2) - vertex.y
      // PlaneGeometry creates Y from +height/2 to -height/2.
      // Let's generate local Z from 0 to CHUNK_SIZE.
      const localZ = v * TerrainChunk.CHUNK_SIZE;

      for (let x = 0; x <= resX; x++) {
        const u = (x / resX) * 2 - 1; // -1 to 1
        const localX = this.getDistributedX(u);

        const index = z * (resX + 1) + x;

        // Positions (x, y, z) - Y is up in 3D, but PlaneGeometry uses X,Y for plane.
        // We are building a 3D mesh directly.
        // Let's use X, Y, Z where Y is height.
        positions[index * 3] = localX;
        positions[index * 3 + 1] = 0; // Height placeholder
        positions[index * 3 + 2] = localZ;

        // UVs
        // Map X linearly or based on distribution?
        // If we map linearly based on U, texture stretches.
        // If we map based on position, texture is uniform.
        // Let's map based on position for uniform texture density.
        uvs[index * 2] = (localX / TerrainChunk.CHUNK_WIDTH) + 0.5;
        uvs[index * 2 + 1] = v;
      }
    }

    // Generate Indices
    for (let z = 0; z < resZ; z++) {
      for (let x = 0; x < resX; x++) {
        const a = z * (resX + 1) + x;
        const b = z * (resX + 1) + (x + 1);
        const c = (z + 1) * (resX + 1) + x;
        const d = (z + 1) * (resX + 1) + (x + 1);

        // Two triangles: a-c-b, b-c-d
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return geometry;
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

  private generateMesh(): THREE.Mesh {
    const geometry = this.createCustomGridGeometry();
    const positions = geometry.attributes.position;
    // const normals = geometry.attributes.normal; // Normals will be computed later

    // Add color attribute
    const count = positions.count;
    const colors = new Float32Array(count * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const colorDry = new THREE.Color(0xE6C288); // Sand/Dry
    const colorWet = new THREE.Color(0x5CB85C); // Grass/Wet

    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i); // This is 0 to CHUNK_SIZE

      // Transform to world space
      const worldZ = this.zOffset + localZ;

      // Deform X based on river path
      const riverCenter = this.riverSystem.getRiverCenter(worldZ);
      const worldX = localX + riverCenter;

      // Calculate height relative to river center
      const height = this.calculateHeight(localX, worldZ);

      positions.setX(i, worldX); // Set actual world X
      positions.setY(i, height);

      // Calculate Wetness
      // Low frequency noise for wetness map
      let wetness = this.noise.noise2D(worldX * 0.002, worldZ * 0.002);
      wetness = (wetness + 1) / 2; // 0 to 1

      // Bias wetness near river?
      // Maybe slightly, but user said "varies slowly".
      // Let's stick to the noise map primarily.

      // Set Color
      const color = new THREE.Color().lerpColors(colorDry, colorWet, wetness);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.computeVertexNormals(); // Recompute with new heights

    // Create custom gradient for toon shading (3-step cartoon look)
    const gradientColors = new Uint8Array([
      0, 0, 0,        // Dark shadow
      100, 100, 100,  // Mid-tone
      200, 200, 200,  // Highlight
      255, 255, 255   // Bright highlight
    ]);
    const gradientMap = new THREE.DataTexture(gradientColors, 4, 1, THREE.RGBFormat);
    gradientMap.needsUpdate = true;

    const material = new THREE.MeshToonMaterial({
      vertexColors: true, // Use vertex colors
      gradientMap: gradientMap,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, this.zOffset);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  private generateWater(): THREE.Mesh {
    const geometry = this.createCustomGridGeometry();
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i);
      const worldZ = this.zOffset + localZ;

      const riverCenter = this.riverSystem.getRiverCenter(worldZ);
      positions.setX(i, localX + riverCenter);
      // Y is 0 by default
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

  dispose() {
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
}
