import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { RiverSystem } from './RiverSystem';
import { Decorations } from './Decorations';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Profiler } from '../core/Profiler';
import { WaterShader } from '../shaders/WaterShader';

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
  public static waterMaterial: THREE.ShaderMaterial; // Shared material

  public static getBiomeWeights(z: number): { desert: number, forest: number, ice: number } {
    // Biome Selection (Z-dependent only)
    // Noise -1 to 1
    // Lower frequency for larger biomes (Tripled size: 0.0005 -> 0.000166)
    let n = this.biomeNoise.noise2D(100, z * 0.000166);

    // Helper for smoothstep
    const smoothstep = (min: number, max: number, value: number): number => {
      const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return x * x * (3 - 2 * x);
    };

    // Define Ranges:
    // n < -0.2: Mostly Desert
    // -0.2 < n < 0.2: Transition Desert -> Forest
    // 0.2 < n < 0.5: Mostly Forest
    // 0.5 < n < 0.9: Transition Forest -> Ice
    // n > 0.9: Mostly Ice

    // Desert Weight: 1.0 at -1.0, 0.0 at 0.0
    const desert = 1.0 - smoothstep(-0.4, 0.1, n);

    // Ice Weight: 0.0 at 0.4, 1.0 at 0.9
    const ice = smoothstep(0.4, 0.9, n);

    // Forest Weight: Remainder
    // Clamp to ensure no negative values (though logic above should prevent overlap > 1)
    const forest = Math.max(0, 1.0 - desert - ice);

    return { desert, forest, ice };
  }

  zOffset: number;
  private noise: SimplexNoise;
  private riverSystem: RiverSystem;
  private graphicsEngine: GraphicsEngine;

  private constructor(
    zOffset: number,
    graphicsEngine: GraphicsEngine
  ) {
    this.zOffset = zOffset;
    this.graphicsEngine = graphicsEngine;
    this.noise = new SimplexNoise(200);
    this.riverSystem = RiverSystem.getInstance();

    // Mesh generation is now async, handled in initAsync
    // We initialize properties to null/empty first or rely on ! assertion if we are careful
    // But typescript expects them to be initialized.
    // Let's make them definite assignment assertion or initialize with empty.
    this.mesh = new THREE.Mesh();
    this.waterMesh = new THREE.Mesh();
    this.decorations = new THREE.Group();
  }

  private mixers: THREE.AnimationMixer[] = [];

  public update(dt: number) {
    for (const mixer of this.mixers) {
      mixer.update(dt);
    }
  }

  public static async createAsync(zOffset: number, graphicsEngine: GraphicsEngine): Promise<TerrainChunk> {
    const chunk = new TerrainChunk(zOffset, graphicsEngine);
    await chunk.initAsync();
    return chunk;
  }

  private async initAsync() {
    this.mesh = await this.generateMesh();
    await this.yieldToMain();

    this.waterMesh = this.generateWater(); // Fast enough to be sync? Or make async too?
    // Water is simple plane, sync is fine.

    this.decorations = await this.generateDecorations();

    this.graphicsEngine.add(this.mesh);
    this.graphicsEngine.add(this.waterMesh);
    this.graphicsEngine.add(this.decorations);
  }

  private yieldToMain(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  private async generateMesh(): Promise<THREE.Mesh> {
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

    const colorDry = { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 }; // Rich Ochre (Desert)
    const colorWet = { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 }; // Rich Dark Green (Forest)
    const colorIce = { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 }; // White/Blue (Ice)

    // Helper for distribution
    const getDistributedX = (u: number, width: number): number => {
      const C = width / 4;
      return C * u * (1 + (u * u));
    };

    // Generate Vertices
    Profiler.start('GenMeshBatch');
    for (let z = 0; z <= resZ; z++) {
      // Yield every few rows to keep frame rate smooth
      if (z % 5 === 0) {
        Profiler.end('GenMeshBatch');
        await this.yieldToMain();
        Profiler.start('GenMeshBatch');
      }

      const v = z / resZ;
      const localZ = v * chunkSize;
      const worldZ = this.zOffset + localZ;

      const weights = TerrainChunk.getBiomeWeights(worldZ);

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

        // Blend 3 colors
        colors[index * 3] = colorDry.r * weights.desert + colorWet.r * weights.forest + colorIce.r * weights.ice;
        colors[index * 3 + 1] = colorDry.g * weights.desert + colorWet.g * weights.forest + colorIce.g * weights.ice;
        colors[index * 3 + 2] = colorDry.b * weights.desert + colorWet.b * weights.forest + colorIce.b * weights.ice;

        // UVs
        uvs[index * 2] = (localX / chunkWidth) + 0.5;
        uvs[index * 2 + 1] = v;
      }
    }
    Profiler.end('GenMeshBatch');

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
    // Brightened shadows
    const gradientColors = new Uint8Array([
      100, 100, 100, 255, // Shadow (was 50)
      180, 180, 180, 255, // Mid (was 100)
      255, 255, 255, 255  // Highlight
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

  private async generateDecorations(): Promise<THREE.Group> {
    const group = new THREE.Group();
    const geometriesByMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

    // Generate procedural decorations (trees, rocks, bushes, etc.)
    await this.generateProceduralDecorations(geometriesByMaterial);

    // Generate shore animals (polar bears and alligators)
    await this.generateShoreAnimals(group);

    // Merge geometries and create meshes
    this.mergeAndAddGeometries(geometriesByMaterial, group);

    return group;
  }

  private async generateProceduralDecorations(
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>
  ): Promise<void> {
    const count = 1000;

    Profiler.start('GenDecoBatch');
    for (let i = 0; i < count; i++) {
      // Yield every 50 iterations
      if (i % 50 === 0) {
        Profiler.end('GenDecoBatch');
        await this.yieldToMain();
        Profiler.start('GenDecoBatch');
      }

      const position = this.generateRandomPosition();
      if (!this.isValidDecorationPosition(position)) continue;

      const biomeType = this.selectBiomeType(position.worldZ);
      const decoration = this.selectDecoration(biomeType);

      if (decoration) {
        this.positionAndCollectGeometry(decoration, position, geometriesByMaterial);
      }
    }
    Profiler.end('GenDecoBatch');
  }

  private generateRandomPosition() {
    const localZ = Math.random() * TerrainChunk.CHUNK_SIZE;
    const worldZ = this.zOffset + localZ;
    const u = Math.random() * 2 - 1;
    const localX = u * (TerrainChunk.CHUNK_WIDTH / 2);
    const riverCenter = this.riverSystem.getRiverCenter(worldZ);
    const worldX = localX + riverCenter;
    const height = this.calculateHeight(localX, worldZ);

    return { localX, localZ, worldX, worldZ, height };
  }

  private isValidDecorationPosition(position: {
    localX: number;
    worldZ: number;
    height: number;
  }): boolean {
    const riverWidth = this.riverSystem.getRiverWidth(position.worldZ);
    const distFromCenter = Math.abs(position.localX);
    const distFromBank = distFromCenter - riverWidth / 2;

    // Apply distance-based probability bias
    if (distFromBank > 0) {
      const biasDistance = 80;
      const normalizedDist = Math.min(1.0, distFromBank / biasDistance);
      const probability = Math.pow(1.0 - normalizedDist, 2);
      if (Math.random() > probability) return false;
    }

    // Check minimum height
    if (position.height < 2.0) return false;

    // Check visibility
    if (!this.checkVisibility(position.localX, position.height, position.worldZ)) {
      return false;
    }

    return true;
  }

  private selectBiomeType(worldZ: number): 'desert' | 'forest' | 'ice' {
    const weights = TerrainChunk.getBiomeWeights(worldZ);

    // Force Ice biome if there is any significant ice weight
    if (weights.ice > 0.1) {
      return 'ice';
    }

    const r = Math.random();
    if (r < weights.desert) return 'desert';
    return 'forest';
  }

  private selectDecoration(biomeType: 'desert' | 'forest' | 'ice'): THREE.Object3D | null {
    if (biomeType === 'desert') {
      if (Math.random() > 0.8) {
        return Decorations.getCactus();
      } else if (Math.random() > 0.96) {
        return Decorations.getRock('desert', Math.random());
      }
    } else if (biomeType === 'forest') {
      if (Math.random() > 0.8) {
        return Decorations.getTree(Math.random(), false, false);
      } else if (Math.random() > 0.96) {
        return Decorations.getRock('forest', Math.random());
      }
    } else if (biomeType === 'ice') {
      if (Math.random() > 0.8) {
        const isLeafless = Math.random() > 0.5;
        return Decorations.getTree(Math.random(), !isLeafless, isLeafless);
      } else if (Math.random() > 0.90) {
        return Decorations.getRock('ice', Math.random());
      }
    }

    return null;
  }

  private positionAndCollectGeometry(
    object: THREE.Object3D,
    position: { worldX: number; height: number; worldZ: number },
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>
  ): void {
    object.position.set(position.worldX, position.height, position.worldZ);
    object.rotation.y = Math.random() * Math.PI * 2;
    object.updateMatrixWorld(true);

    // Collect geometries for merging
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry.clone();
        geometry.applyMatrix4(child.matrixWorld);

        const material = child.material as THREE.Material;
        if (!geometriesByMaterial.has(material)) {
          geometriesByMaterial.set(material, []);
        }
        geometriesByMaterial.get(material)!.push(geometry);
      }
    });
  }

  private async generateShoreAnimals(group: THREE.Group): Promise<void> {
    Profiler.start('GenShoreAnimals');
    const shoreAnimalCount = 5;

    for (let i = 0; i < shoreAnimalCount; i++) {
      const localZ = Math.random() * TerrainChunk.CHUNK_SIZE;
      const worldZ = this.zOffset + localZ;
      const weights = TerrainChunk.getBiomeWeights(worldZ);

      const animalData = this.selectShoreAnimal(weights);
      if (!animalData) continue;

      const placement = this.calculateShoreAnimalPlacement(worldZ);
      //if (placement.height <= 2.0) continue;

      // Check slope (must be < 30 degrees from upright)
      const normal = this.calculateNormal(placement.localX, placement.worldZ);
      const up = new THREE.Vector3(0, 1, 0);
      if (normal.angleTo(up) > THREE.MathUtils.degToRad(20)) continue;

      this.placeShoreAnimal(animalData, placement, group);
    }

    Profiler.end('GenShoreAnimals');
  }

  private selectShoreAnimal(weights: {
    desert: number;
    forest: number;
    ice: number;
  }): { model: THREE.Group; animations: THREE.AnimationClip[] } | null {
    if (weights.ice > 0.5 && Math.random() < 0.3) {
      return Decorations.getPolarBear();
    } else if (weights.desert > 0.5 && Math.random() < 0.3) {
      return Decorations.getAlligator();
    }
    return null;
  }

  private calculateShoreAnimalPlacement(worldZ: number) {
    const riverWidth = this.riverSystem.getRiverWidth(worldZ);
    const riverCenter = this.riverSystem.getRiverCenter(worldZ);
    const isLeftBank = Math.random() > 0.5;
    const distFromBank = 2.5 + Math.random() * 3.0;
    const localX = (isLeftBank ? -1 : 1) * (riverWidth / 2 + distFromBank);
    const worldX = localX + riverCenter;
    const height = this.calculateHeight(localX, worldZ);

    return { localX, worldX, worldZ, height, isLeftBank };
  }

  private placeShoreAnimal(
    animalData: { model: THREE.Group; animations: THREE.AnimationClip[] },
    placement: { localX: number; worldX: number; worldZ: number; height: number; isLeftBank: boolean },
    group: THREE.Group
  ): void {
    const animal = animalData.model;
    animal.position.set(placement.worldX, placement.height, placement.worldZ);

    // Calculate and apply rotation
    const terrainNormal = this.calculateNormal(placement.localX, placement.worldZ);
    this.orientAnimalToTerrain(animal, terrainNormal, placement.isLeftBank, placement.worldZ);

    // Scale
    const baseScale = 3.0;
    const scale = baseScale * (0.9 + Math.random() * 0.2);
    animal.scale.set(scale, scale, scale);

    // Setup animation
    if (animalData.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(animal);
      // Randomize start time
      const action = mixer.clipAction(animalData.animations[0]);
      action.time = Math.random() * action.getClip().duration;
      action.play();
      this.mixers.push(mixer);
    }

    // Enable shadows
    animal.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    group.add(animal);
  }

  private orientAnimalToTerrain(
    animal: THREE.Group,
    terrainNormal: THREE.Vector3,
    isLeftBank: boolean,
    worldZ: number
  ): void {
    // Align model's Y-axis with terrain normal
    const modelUpAxis = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(modelUpAxis, terrainNormal);
    animal.quaternion.copy(quaternion);

    // Rotate around normal to face water with +/- 45 degrees variation
    const riverDerivative = this.riverSystem.getRiverDerivative(worldZ);
    const riverAngle = Math.atan(riverDerivative);
    let baseAngle = isLeftBank ? Math.PI / 2 : -Math.PI / 2;
    baseAngle += riverAngle;

    // Add random variation between -45 and +45 degrees (PI/4)
    // (Math.random() - 0.5) is [-0.5, 0.5]
    // Multiply by PI/2 to get [-PI/4, PI/4]
    baseAngle += (Math.random() - 0.5) * (Math.PI / 2);

    const rotationAroundNormal = new THREE.Quaternion();
    rotationAroundNormal.setFromAxisAngle(terrainNormal, baseAngle);
    animal.quaternion.premultiply(rotationAroundNormal);
  }

  private mergeAndAddGeometries(
    geometriesByMaterial: Map<THREE.Material, THREE.BufferGeometry[]>,
    group: THREE.Group
  ): void {
    for (const [material, geometries] of geometriesByMaterial) {
      if (geometries.length === 0) continue;
      const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
      const mesh = new THREE.Mesh(mergedGeometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
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
    // Do NOT dispose shared water material
    // if (Array.isArray(this.waterMesh.material)) {
    //   this.waterMesh.material.forEach(m => m.dispose());
    // } else {
    //   this.waterMesh.material.dispose();
    // }

    this.graphicsEngine.remove(this.decorations);
    // Dispose children materials/geometries if needed
    // Since we reuse static materials in Decorations, we might not want to dispose them?
    // Actually Decorations uses static materials, so we shouldn't dispose them here.
    // Just remove from scene and clear children.

    // BUT, the geometries are merged and unique to this chunk! We MUST dispose them.
    this.decorations.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        // Material is shared, do not dispose.
      }
    });
    this.decorations.clear();

    // Stop animations
    this.mixers.forEach(mixer => mixer.stopAllAction());
    this.mixers = [];
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

    if (!TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(WaterShader.uniforms),
        vertexShader: WaterShader.vertexShader,
        fragmentShader: WaterShader.fragmentShader,
        transparent: true,
        side: THREE.DoubleSide // Ensure water is visible from below if needed, though mostly top-down
      });
    }

    const mesh = new THREE.Mesh(geometry, TerrainChunk.waterMaterial);
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
