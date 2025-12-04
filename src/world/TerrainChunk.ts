import * as THREE from 'three';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { RiverSystem } from './RiverSystem';
import { Decorations } from './Decorations';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Profiler } from '../core/Profiler';
import { WaterShader } from '../shaders/WaterShader';
import { TerrainDecorator, DecorationContext } from './decorators/TerrainDecorator';

export class TerrainChunk {

  // Materials
  static waterMaterial: THREE.ShaderMaterial | null = null;

  mesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  decorations: THREE.Group;
  zOffset: number;

  // Config
  public static readonly CHUNK_SIZE = 62.5; // Size of chunk in Z (Reduced to 62.5 for incremental generation)
  public static readonly CHUNK_WIDTH = 400; // Width of world in X
  public static readonly RESOLUTION_X = 160; // Vertices along X
  public static readonly RESOLUTION_Z = 25; // Vertices along Z (Reduced to 25)

  private riverSystem: RiverSystem;
  private graphicsEngine: GraphicsEngine;
  private mixers: THREE.AnimationMixer[] = [];

  public static async createAsync(
    zOffset: number,
    graphicsEngine: GraphicsEngine,
    decorators: TerrainDecorator[]):
    Promise<TerrainChunk> {
    const chunk = new TerrainChunk(zOffset, graphicsEngine);
    await chunk.initAsync(decorators);
    return chunk;
  }

  private constructor(
    zOffset: number,
    graphicsEngine: GraphicsEngine
  ) {
    this.zOffset = zOffset;
    this.graphicsEngine = graphicsEngine;
    this.riverSystem = RiverSystem.getInstance();

    // Mesh generation is now async, handled in initAsync
    // We initialize properties to null/empty first or rely on ! assertion if we are careful
    // But typescript expects them to be initialized.
    // Let's make them definite assignment assertion or initialize with empty.
    this.mesh = new THREE.Mesh();
    this.waterMesh = new THREE.Mesh();
    this.decorations = new THREE.Group();
  }

  public update(dt: number) {
    for (const mixer of this.mixers) {
      mixer.update(dt);
    }
  }

  private async initAsync(decorators: TerrainDecorator[]) {
    this.mesh = await this.generateMesh();
    await this.yieldToMain();

    this.waterMesh = this.generateWater(); // Fast enough to be sync? Or make async too?
    // Water is simple plane, sync is fine.

    this.decorations = await this.generateDecorations(decorators);

    this.graphicsEngine.add(this.mesh);
    this.graphicsEngine.add(this.waterMesh);
    this.graphicsEngine.add(this.decorations);
  }

  // ... (yieldToMain, generateMesh)

  private async generateDecorations(decorators: TerrainDecorator[]): Promise<THREE.Group> {
    const geometryGroup = new THREE.Group();
    const geometriesByMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

    const context: DecorationContext = {
      chunk: this,
      riverSystem: this.riverSystem,
      geometriesByMaterial: geometriesByMaterial,
      geometryGroup: geometryGroup,
      animationMixers: this.mixers,
      zOffset: this.zOffset
    };

    Profiler.start('GenDecoBatch');
    for (const decorator of decorators) {
      await decorator.decorate(context);
      await this.yieldToMain();
    }
    Profiler.end('GenDecoBatch');

    // Merge geometries and create meshes
    this.mergeAndAddGeometries(geometriesByMaterial, geometryGroup);

    return geometryGroup;
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



      for (let x = 0; x <= resX; x++) {
        const u = (x / resX) * 2 - 1;
        const localX = getDistributedX(u, chunkWidth);

        const index = z * (resX + 1) + x;

        const riverCenter = this.riverSystem.getRiverCenter(worldZ);
        const worldX = localX + riverCenter;
        const height = this.riverSystem.terrainGeometry.calculateHeight(localX, worldZ);

        positions[index * 3] = worldX;
        positions[index * 3 + 1] = height;
        positions[index * 3 + 2] = localZ;

        // Colors
        // Purely biome based, maybe slight noise variation but mostly solid
        // Lerp between Desert and Forest based on biomeFactor

        const color = this.riverSystem.getBiomeManager().getBiomeGroundColor(worldZ);
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;

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


}
