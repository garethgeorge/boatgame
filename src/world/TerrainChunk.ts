import {
  Mesh,
  Vector3,
  VertexData,
  StandardMaterial,
  Color3,
  Texture,
  RawTexture,
  Constants,
  Scene,
  AbstractMesh,
  TransformNode,
  AnimationGroup
} from '@babylonjs/core';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { RiverSystem } from './RiverSystem';
// import { Decorations } from './Decorations'; // TODO: Migrate Decorations
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'; // Babylon has MergeMeshes
import { Profiler } from '../core/Profiler';
import { WaterMaterial } from '../materials/WaterMaterial';
// import { TerrainDecorator, DecorationContext } from './decorators/TerrainDecorator'; 
// import { ResourceDisposer } from '../core/ResourceDisposer'; // Not needed for Babylon

export class TerrainChunk {

  // Materials
  static waterMaterial: WaterMaterial | null = null;

  mesh: Mesh;
  waterMesh: Mesh;
  decorations: TransformNode;
  zOffset: number;

  // Config
  public static readonly CHUNK_SIZE = 62.5;
  public static readonly CHUNK_WIDTH = 400;
  public static readonly RESOLUTION_X = 160;
  public static readonly RESOLUTION_Z = 25;

  private riverSystem: RiverSystem;
  private graphicsEngine: GraphicsEngine;
  // private mixers: THREE.AnimationMixer[] = []; // Babylon uses AnimationGroups

  public static async createAsync(
    zOffset: number,
    graphicsEngine: GraphicsEngine):
    Promise<TerrainChunk> {
    const chunk = new TerrainChunk(zOffset, graphicsEngine);
    await chunk.initAsync();
    return chunk;
  }

  private constructor(
    zOffset: number,
    graphicsEngine: GraphicsEngine
  ) {
    this.zOffset = zOffset;
    this.graphicsEngine = graphicsEngine;
    this.riverSystem = RiverSystem.getInstance();

    this.mesh = new Mesh("terrain_chunk_" + zOffset, graphicsEngine.scene);
    this.waterMesh = new Mesh("water_chunk_" + zOffset, graphicsEngine.scene);
    this.decorations = new TransformNode("decorations_chunk_" + zOffset, graphicsEngine.scene);
    this.decorations.parent = this.mesh;
  }

  public update(dt: number) {
    // Babylon handles animations automatically via scene
  }

  private async initAsync() {
    this.mesh = await this.generateMesh();
    await this.yieldToMain();

    this.waterMesh = this.generateWater();

    this.decorations = await this.generateDecorations();

    // Setting parent to ensure hierarchy if needed, but they are already in scene
  }

  private yieldToMain(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  private async generateMesh(): Promise<Mesh> {
    const chunkSize = TerrainChunk.CHUNK_SIZE;
    const chunkWidth = TerrainChunk.CHUNK_WIDTH;
    const resX = TerrainChunk.RESOLUTION_X;
    const resZ = TerrainChunk.RESOLUTION_Z;

    const numVertices = (resX + 1) * (resZ + 1);

    // Babylon vertex data buffers
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

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
        Profiler.pause('GenMeshBatch');
        await this.yieldToMain();
        Profiler.resume('GenMeshBatch');
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

        positions.push(wx, height, wz);

        // Colors
        // Purely biome based, maybe slight noise variation but mostly solid
        // Lerp between Desert and Forest based on biomeFactor
        const color = this.riverSystem.biomeManager.getBiomeGroundColor(wz);

        // Babylon uses 0-1 float colors usually, ThreeJS Color is 0-1 floats internally too?
        // ThreeJS Color components are 0-1.
        colors.push(color.r, color.g, color.b, 1.0); // Add Alpha

        // u = [0, 1] from chunk edge to edge
        // v = [0, 1] from chunk near to far
        uvs.push((wx / chunkWidth) + 0.5, tz);
      }
    }
    Profiler.end('GenMeshBatch');

    // Generate triangle indices
    for (let iz = 0; iz < resZ; iz++) {
      for (let ix = 0; ix < resX; ix++) {
        const a = iz * (resX + 1) + ix;
        const b = (iz + 1) * (resX + 1) + ix;
        const c = (iz + 1) * (resX + 1) + (ix + 1);
        const d = iz * (resX + 1) + (ix + 1);

        // Babylon standard material side orientation might differ.
        // Assuming Standard, CCW winding? 
        // ThreeJS default is CCW front face. Babylon is also CCW by default if sideOrientation is not set.

        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }

    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.colors = colors;
    vertexData.uvs = uvs;

    // Compute Normals
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vertexData.normals = normals;

    const mesh = new Mesh("terrain_" + this.zOffset, this.graphicsEngine.scene);
    vertexData.applyToMesh(mesh);

    // Create custom gradient for toon shading
    // Babylonjs CellMaterial or StandardMaterial with simplified lighting
    const material = new StandardMaterial("terrain_mat_" + this.zOffset, this.graphicsEngine.scene);

    // Toon shading in StandardMaterial?
    // We can use 2-3 lights or just diffuse color with minimal specular.
    // Or we can use a custom shader later.
    // For compatibility with "MeshToonMaterial gradientMap", allow's approximate.
    material.specularColor = Color3.Black(); // No specular highlight
    material.emissiveColor = new Color3(0, 0, 0);

    // To mimic toon shading more accurately we might need a custom shader or NME.
    // But for now, just vertex colors.
    // Important: StandardMaterial vertex colors usage
    // material.diffuseColor; // handled by vertex colors if useVertexColors = true?
    // Babylon vertex colors are multiplied with diffuseColor.

    // To enable vertex colors:
    mesh.useVertexColors = true;

    // Gradient map logic from ThreeJS is harder to do in StandardMaterial without custom shader.
    // It creates the stepped look. 
    // We can assume smooth lighting for now or use NodeMaterial later.

    // mesh.receiveShadows = true; // Shadows later

    // const gradientMap = new THREE.DataTexture... - This is specific to MeshToonMaterial.
    // Babylon doesn't have a direct "Toon" toggle on StandardMaterial.

    mesh.material = material;

    return mesh;
  }

  dispose() {
    this.mesh.dispose();
    this.waterMesh.dispose();
    this.decorations.dispose();
    // Material disposal is automatic if unique, but WaterMaterial is static shared.
    // Static materials should NOT be disposed.
  }

  private async generateDecorations(): Promise<TransformNode> {
    const root = new TransformNode("decorations_chunk_" + this.zOffset, this.graphicsEngine.scene);

    // Use dynamic imports to avoid circular dependencies with decorators (which import TerrainChunk)
    const [
      { TreeDecorator },
      { RockDecorator },
      { CactusDecorator },
      { CycadDecorator },
      { TreeFernDecorator }
    ] = await Promise.all([
      import('./decorators/TreeDecorator'),
      import('./decorators/RockDecorator'),
      import('./decorators/CactusDecorator'),
      import('./decorators/CycadDecorator'),
      import('./decorators/TreeFernDecorator')
    ]);

    const decorators = [
      new TreeDecorator(),
      new RockDecorator(),
      new CactusDecorator(),
      new CycadDecorator(),
      new TreeFernDecorator()
    ];

    const context = {
      chunk: this,
      riverSystem: this.riverSystem,
      root: root,
      zOffset: this.zOffset
    };

    for (const decorator of decorators) {
      await decorator.decorate(context);
    }

    return root;
  }

  private generateWater(): Mesh {
    const geometryWidth = TerrainChunk.CHUNK_WIDTH;
    const geometryHeight = TerrainChunk.CHUNK_SIZE;
    const subdivisionsX = TerrainChunk.RESOLUTION_X - 1;
    const subdivisionsZ = TerrainChunk.RESOLUTION_Z - 1;

    // Create Plane Logic manually because we need custom position data modification or use UpdateVertices
    // Babylon CreateGround is easier, aligned on XZ plane.
    // Width (X), Height (Z).

    const waterMesh = Mesh.CreateGround("water_" + this.zOffset,
      geometryWidth,
      geometryHeight,
      Math.min(subdivisionsX, subdivisionsZ), // subdivisions logic different in Babylon (it's square usually?)
      this.graphicsEngine.scene,
      true // Updatable
    );
    // CreateGround subdivision is integer count for both sides? No, it's 'subdivisions'.
    // If we want different X/Z resolution we might need CreateGroundFromHeightMap or Custom.
    // Let's stick to Custom to match exact vertex structure of ThreeJS implementation to ensure 1:1 match

    const vertexData = VertexData.CreateGround({
      width: geometryWidth,
      height: geometryHeight,
      subdivisionsX: subdivisionsX,
      subdivisionsY: subdivisionsZ // Y is Z in CreateGround params usually
    });

    const positions = vertexData.positions!;
    // positions are Float32Array or number[]
    // They are centered around 0,0,0.

    // We need to shift Z to be 0 to CHUNK_SIZE?
    // Plane in Babylon is centered.
    // Z is -height/2 to +height/2.
    // We want 0 to height?
    // The previous implementation: geometry.translate(0, 0, TerrainChunk.CHUNK_SIZE / 2);
    // So current Z range is [-size/2, size/2] -> [0, size].

    for (let i = 0; i < positions.length; i += 3) {
      // x, y, z
      // Babylon Ground is flat on XZ plane, y=0.
      let localX = positions[i];
      let localZ = positions[i + 2];

      // Shift Z
      localZ += TerrainChunk.CHUNK_SIZE / 2;
      positions[i + 2] = localZ;

      const worldZ = this.zOffset + localZ;
      const riverCenter = this.riverSystem.getRiverCenter(worldZ);

      positions[i] = localX + riverCenter;

      // Y is 0
    }

    vertexData.applyToMesh(waterMesh);

    if (!TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial = new WaterMaterial("waterMat", this.graphicsEngine.scene);
    }

    waterMesh.material = TerrainChunk.waterMaterial;
    // Position mesh at 0,0,0 because vertices are in world space (except Z is local to chunk offset? No wait)

    // "positions[i + 2] = localZ" -> this is 0 to 62.5.
    // "worldZ = this.zOffset + localZ" -> actual world Z.
    // Wait, in previous implementation:
    // "positions.setZ(i, worldZ);" -> previous implemented set Absolute World Z in the buffer.
    // "mesh.position.set(0, 0, 0);"

    // My loop above:
    // positions[i+2] = localZ.
    // This leaves the mesh LOCAL coordinates.
    // We should set it to worldZ if we want to place mesh at 0,0,0.

    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 2] += this.zOffset;
    }
    // Now positions are World Coordinates.

    vertexData.applyToMesh(waterMesh);

    waterMesh.position.set(0, 0, 0);

    return waterMesh;
  }
}