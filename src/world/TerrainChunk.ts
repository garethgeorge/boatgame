import * as THREE from 'three';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { RiverSystem } from './RiverSystem';
import { Decorations } from './Decorations';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Profiler } from '../core/Profiler';
import { WaterShader } from '../shaders/WaterShader';
import { TerrainDecorator, DecorationContext } from './decorators/TerrainDecorator';
import { ResourceDisposer } from '../core/ResourceDisposer';

export class TerrainChunk {

  // Materials
  static waterMaterial: THREE.ShaderMaterial | null = null;

  mesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  decorations: THREE.Group;
  zOffset: number;

  private disposer: ResourceDisposer = new ResourceDisposer();

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

    // Maps [-1,1] to [-width/2,width/2] with closer spacing near 0
    const getDistributedX = (u: number, width: number): number => {
      const C = width / 4;
      return C * u * (1 + (u * u));
    };

    // Generate Vertices
    Profiler.start('GenMeshBatch');

    // Iterate from chunk near to far
    for (let iz = 0; iz <= resZ; iz++) {
      // Yield every few rows to keep frame rate smooth
      if (iz % 5 === 0) {
        Profiler.end('GenMeshBatch');
        await this.yieldToMain();
        Profiler.start('GenMeshBatch');
      }

      // tz is parametric [0,1] from chunk near to far
      // dz is chunk relative z position
      // wz is world z position
      const tz = iz / resZ;
      const dz = tz * chunkSize;
      const wz = this.zOffset + dz;

      // Now iterate across chunk width
      for (let ix = 0; ix <= resX; ix++) {
        // tx is parametric [-1,1] from chunk edge to edge
        const tx = (ix / resX) * 2 - 1;
        // dx is chunk offset relative to center with a non linear distribution
        const dx = getDistributedX(tx, chunkWidth);

        // river system center in world space
        const riverCenter = this.riverSystem.getRiverCenter(wz);
        const wx = dx + riverCenter;
        const height = this.riverSystem.terrainGeometry.calculateHeight(wx, wz);

        const index = iz * (resX + 1) + ix;
        positions[index * 3] = wx;
        positions[index * 3 + 1] = height;
        positions[index * 3 + 2] = wz;

        // Colors
        // Purely biome based, maybe slight noise variation but mostly solid
        // Lerp between Desert and Forest based on biomeFactor
        const color = this.riverSystem.biomeManager.getBiomeGroundColor(wz);
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;

        // u = [0, 1] from chunk edge to edge
        // v = [0, 1] from chunk near to far
        uvs[index * 2] = (wx / chunkWidth) + 0.5;
        uvs[index * 2 + 1] = tz;
      }
    }
    Profiler.end('GenMeshBatch');

    // Generate triangle indices
    let i = 0;
    for (let iz = 0; iz < resZ; iz++) {
      for (let ix = 0; ix < resX; ix++) {
        const a = iz * (resX + 1) + ix;
        const b = (iz + 1) * (resX + 1) + ix;
        const c = (iz + 1) * (resX + 1) + (ix + 1);
        const d = iz * (resX + 1) + (ix + 1);

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

    // Register with disposer
    this.disposer.add(geometry);
    this.disposer.add(material);
    this.disposer.add(gradientMap);

    const mesh = new THREE.Mesh(geometry, material);
    // Vertices are already in world coordinates, no mesh offset needed
    mesh.position.set(0, 0, 0);

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
      this.disposer.add(mergedGeometry); // Register merged geo

      const mesh = new THREE.Mesh(mergedGeometry, material);
      // Material is shared from decorators, so we DON'T dispose it here

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Dispose of the source geometries (clones) now that they are merged
      for (const geometry of geometries) {
        geometry.dispose();
      }
    }
  }

  dispose() {
    this.graphicsEngine.remove(this.mesh);
    this.graphicsEngine.remove(this.waterMesh);
    this.graphicsEngine.remove(this.decorations);

    // Disposer handles geometry, materials, and textures for main mesh and water mesh
    this.disposer.dispose();

    // Decorations disposal:
    // mergeAndAddGeometries registered the merged geometries.
    // Materials were shared (static), so we do NOT dispose them.
    // However, if we added them to disposer in generateDecorations, we would have trouble.
    // Checks: We did NOT add shared materials to disposer in mergeAndAddGeometries. Correct.

    // Clear the group logic
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
      // Convert to world coordinates for both X and Z
      positions.setX(i, localX + riverCenter);
      positions.setZ(i, worldZ);
    }
    geometry.computeVertexNormals();

    if (!TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(WaterShader.uniforms),
        vertexShader: WaterShader.vertexShader,
        fragmentShader: WaterShader.fragmentShader,
        transparent: true,
        side: THREE.DoubleSide, // Ensure water is visible from below if needed, though mostly top-down
        fog: true
      });
    }

    // Register geometry (unique per chunk)
    this.disposer.add(geometry);
    // DO NOT register waterMaterial (static shared)

    const mesh = new THREE.Mesh(geometry, TerrainChunk.waterMaterial);
    // Vertices are already in world coordinates, no mesh offset needed
    mesh.position.set(0, 0, 0);

    return mesh;
  }


}
