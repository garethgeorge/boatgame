import * as THREE from 'three';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { RiverSystem } from './RiverSystem';
import { Profiler } from '../core/Profiler';
import { WaterShader } from '../shaders/WaterShader';
import { PopulationContext } from './biomes/PopulationContext';
import { BiomeDecorationHelper } from './biomes/BiomeDecorationHelper';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { EntityManager } from '../core/EntityManager';
import { SpatialGrid } from '../core/SpatialGrid';
import { GraphicsUtils } from '../core/GraphicsUtils';
import { RiverGeometry } from './RiverGeometry';
import { TerrainSlotMap } from './TerrainSlotMap';

export class TerrainChunk {

  // Materials
  static waterMaterial: THREE.ShaderMaterial | null = null;

  // Config
  public static readonly CHUNK_SIZE = 62.5; // Size of chunk in Z (Reduced to 62.5 for incremental generation)
  public static readonly CHUNK_WIDTH = 400; // Width of world in X
  public static readonly RESOLUTION_X = 160; // Vertices along X
  public static readonly RESOLUTION_Z = 25; // Vertices along Z (Reduced to 25)

  public readonly zOffset: number;
  public readonly riverSystem: RiverSystem;
  public readonly spatialGrid: SpatialGrid;
  public readonly slots: TerrainSlotMap = new TerrainSlotMap();

  private graphicsEngine: GraphicsEngine;

  private mesh: THREE.Mesh;
  private waterMesh: THREE.Mesh;
  private decorations: THREE.Group;
  private decorationStats: Map<string, number> = new Map();

  public static create(
    zOffset: number,
    graphicsEngine: GraphicsEngine
  ): TerrainChunk {
    return new TerrainChunk(zOffset, graphicsEngine);
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
    this.mesh = GraphicsUtils.createMesh(undefined, undefined, 'TerrainChunkGround');
    this.waterMesh = GraphicsUtils.createMesh(undefined, undefined, 'TerrainChunkWater');
    this.decorations = new THREE.Group();

    // For keeping track of static items
    this.spatialGrid = new SpatialGrid(30);
  }

  public getDecorationStats(): Map<string, number> {
    return this.decorationStats;
  }

  public update(dt: number) {
  }

  public *getInitIterator(
    physicsEngine: PhysicsEngine,
    entityManager: EntityManager
  ): Generator<void | Promise<void>, void, unknown> {
    console.log('Chunk init started');
    try {
      Profiler.start('GenMeshBatch');
      const meshIterator = this.generateMeshIterator();
      let meshResult = meshIterator.next();
      while (!meshResult.done) {
        Profiler.pause('GenMeshBatch');
        yield meshResult.value as void | Promise<void>;
        Profiler.resume('GenMeshBatch');
        meshResult = meshIterator.next();
      }
      const groundMesh = meshResult.value;
      Profiler.end('GenMeshBatch');
      yield;

      const waterMesh = yield* this.generateWaterIterator();

      GraphicsUtils.disposeObject(this.mesh);
      this.mesh = groundMesh;
      this.graphicsEngine.add(this.mesh);

      GraphicsUtils.disposeObject(this.waterMesh);
      this.waterMesh = waterMesh;
      this.graphicsEngine.add(this.waterMesh);

      Profiler.start('PopulateChunk');
      const populateIterator = this.populateIterator(physicsEngine, entityManager);
      let populateResult = populateIterator.next();
      while (!populateResult.done) {
        Profiler.pause('PopulateChunk');
        yield populateResult.value;
        Profiler.resume('PopulateChunk');
        populateResult = populateIterator.next();
      }
      Profiler.end('PopulateChunk');

    } finally {
      console.log('Chunk init done');
    }
  }

  private *populateIterator(physicsEngine: PhysicsEngine, entityManager: EntityManager): Generator<void | Promise<void>, void, unknown> {
    const zMin = this.zOffset;
    const zMax = zMin + TerrainChunk.CHUNK_SIZE;

    const geometryGroup = new THREE.Group();
    const geometriesByMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const instancedData = new Map<THREE.BufferGeometry, Map<THREE.Material, { matrix: THREE.Matrix4, color?: THREE.Color }[]>>();

    const segments = this.riverSystem.biomeManager.getFeatureSegments(zMin, zMax);

    // Calculate Difficulty
    const centerZ = (zMin + zMax) / 2;
    const distance = Math.abs(centerZ);
    const difficulty = Math.min(distance / 7500, 1.0);

    const context: PopulationContext = {
      chunk: this,
      geometriesByMaterial: geometriesByMaterial,
      instancedData: instancedData,
      geometryGroup: geometryGroup,
      decoHelper: new BiomeDecorationHelper(),
      stats: this.decorationStats,
      entityManager: entityManager,
      physicsEngine: physicsEngine,
    };

    for (const segment of segments) {
      yield* segment.features.populate(context, difficulty, segment.zMin, segment.zMax);
    }

    // Merge geometries and create meshes
    context.decoHelper.mergeAndAddGeometries(context);

    GraphicsUtils.disposeObject(this.decorations);
    this.decorations = geometryGroup;
    this.graphicsEngine.add(this.decorations);
  }

  private *generateMeshIterator(): Generator<void | Promise<void>, THREE.Mesh, unknown> {
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
    // Iterate from chunk near to far
    for (let iz = 0; iz <= resZ; iz++) {
      // Yield every few rows to keep frame rate smooth
      if (iz % 5 === 0) {
        yield;
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

        const color = this.riverSystem.biomeManager.getBiomeGroundColor(wx, height, wz);

        const index = iz * (resX + 1) + ix;
        positions[index * 3] = wx;
        positions[index * 3 + 1] = height;
        positions[index * 3 + 2] = wz;

        // Colors
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;

        // u = [0, 1] from chunk edge to edge
        // v = [0, 1] from chunk near to far
        uvs[index * 2] = (wx / chunkWidth) + 0.5;
        uvs[index * 2 + 1] = tz;
      }
    }

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
    geometry.name = 'TerrainChunk - terrain';
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
    gradientMap.name = 'TerrainChunk - terrain';
    gradientMap.needsUpdate = true;
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshToonMaterial({
      name: 'TerrainChunk - terrain',
      vertexColors: true,
      gradientMap: gradientMap,
      side: THREE.DoubleSide
    });

    const mesh = GraphicsUtils.createMesh(geometry, material, 'TerrainRiverbedDebug');
    // Vertices are already in world coordinates, no mesh offset needed
    mesh.position.set(0, 0, 0);

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    return mesh;
  }

  setVisible(visible: boolean) {
    this.mesh.visible = visible;
    this.waterMesh.visible = visible;
    this.decorations.visible = visible;
  }

  dispose() {
    this.graphicsEngine.remove(this.mesh);
    this.graphicsEngine.remove(this.waterMesh);
    this.graphicsEngine.remove(this.decorations);

    GraphicsUtils.disposeObject(this.mesh);
    GraphicsUtils.disposeObject(this.waterMesh);
    GraphicsUtils.disposeObject(this.decorations);
  }

  private *generateWaterIterator(): Generator<void | Promise<void>, THREE.Mesh, unknown> {
    const geometry = new THREE.PlaneGeometry(
      TerrainChunk.CHUNK_WIDTH,
      TerrainChunk.CHUNK_SIZE,
      TerrainChunk.RESOLUTION_X - 1,
      TerrainChunk.RESOLUTION_Z - 1
    );
    geometry.name = 'TerrainChunk - water';
    geometry.rotateX(-Math.PI / 2);

    // Shift Z to be 0 to CHUNK_SIZE (PlaneGeometry is centered)
    geometry.translate(0, 0, TerrainChunk.CHUNK_SIZE / 2);

    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      if (i % 200 === 0) yield;
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
        fog: true,
        name: 'TerrainChunk - waterMaterial'
      });
      GraphicsUtils.registerObject(TerrainChunk.waterMaterial);
    }

    const mesh = GraphicsUtils.createMesh(geometry, TerrainChunk.waterMaterial, 'TerrainWaterMesh');
    // Vertices are already in world coordinates, no mesh offset needed
    mesh.position.set(0, 0, 0);

    return mesh;
  }


}
