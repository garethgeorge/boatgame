import * as THREE from 'three';
import Matter from 'matter-js';
import { SimplexNoise } from './SimplexNoise';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';

export class TerrainChunk {
  mesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  bodies: Matter.Body[] = [];

  // Config
  private static readonly CHUNK_SIZE = 100; // Size of chunk in Z
  private static readonly CHUNK_WIDTH = 200; // Width of world in X
  private static readonly RESOLUTION = 20; // Vertices per axis
  private static readonly RIVER_WIDTH = 40;

  constructor(
    private zOffset: number,
    private physicsEngine: PhysicsEngine,
    private graphicsEngine: GraphicsEngine,
    private noise: SimplexNoise
  ) {
    this.mesh = this.generateMesh();
    this.waterMesh = this.generateWater();
    this.generateCollision();

    this.graphicsEngine.add(this.mesh);
    this.graphicsEngine.add(this.waterMesh);
    this.bodies.forEach(body => this.physicsEngine.addBody(body));
  }

  private getRiverOffset(z: number): number {
    // Large scale noise for river path
    // Scale 0.002 = 500 units per cycle
    // Amplitude 100 = +/- 100 units sideways
    return this.noise.noise2D(0, z * 0.002) * 100;
  }

  private calculateNormal(x: number, z: number): THREE.Vector3 {
    const epsilon = 0.1;

    // Calculate height gradient
    const h0 = this.calculateHeight(x, z);
    const hx = this.calculateHeight(x + epsilon, z);
    const hz = this.calculateHeight(x, z + epsilon);

    const dhdx = (hx - h0) / epsilon;
    const dhdz = (hz - h0) / epsilon;

    // Calculate river offset gradient
    const off0 = this.getRiverOffset(z);
    const offz = this.getRiverOffset(z + epsilon);
    const doffdz = (offz - off0) / epsilon;

    // The surface is defined by P(x, z) = (x + off(z), h(x, z), z)
    // Tangent vectors:
    // Tu = dP/dx = (1, dh/dx, 0)
    // Tv = dP/dz = (doff/dz, dh/dz, 1)
    // Normal = Tv x Tu (cross product)
    // N = (dh/dz * 0 - 1 * dh/dx,   1 * 1 - doff/dz * 0,   doff/dz * dh/dx - dh/dz * 1)
    // N = (-dh/dx, 1, doff/dz * dh/dx - dh/dz)

    // Wait, let's double check cross product order.
    // Usually we want Up.
    // Tu = (1, dhdx, 0)
    // Tv = (doffdz, dhdz, 1)
    // Tu x Tv:
    // x: dhdx * 1 - 0 * dhdz = dhdx
    // y: 0 * doffdz - 1 * 1 = -1
    // z: 1 * dhdz - dhdx * doffdz = dhdz - dhdx * doffdz
    // This points DOWN (-y). We want UP.
    // So Tv x Tu:
    // x: -dhdx
    // y: 1
    // z: -(dhdz - dhdx * doffdz) = dhdx * doffdz - dhdz

    const nx = -dhdx;
    const ny = 1;
    const nz = dhdx * doffdz - dhdz;

    return new THREE.Vector3(nx, ny, nz).normalize();
  }

  private generateMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      TerrainChunk.CHUNK_WIDTH,
      TerrainChunk.CHUNK_SIZE,
      TerrainChunk.RESOLUTION,
      TerrainChunk.RESOLUTION
    );

    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);

      // Transform to world space for noise sampling
      const worldX = vertex.x; // This is local X relative to center, but since center is 0, it's also offset from center
      // PlaneGeometry is created in XY plane.
      // We rotate it -90 around X.
      // So Local Y becomes World -Z (relative to mesh center).
      // Mesh center is at zOffset + CHUNK_SIZE/2.
      // So WorldZ = CenterZ - LocalY.
      const worldZ = (this.zOffset + TerrainChunk.CHUNK_SIZE / 2) - vertex.y;

      // Calculate height using original local X (relative to river center)
      const height = this.calculateHeight(worldX, worldZ);

      // Apply height (z in PlaneGeometry is height)
      positions.setZ(i, height);

      // Apply river bending offset
      const offset = this.getRiverOffset(worldZ);
      positions.setX(i, vertex.x + offset);

      // Calculate and set normal
      const normal = this.calculateNormal(worldX, worldZ);
      // Rotate normal to match mesh rotation (x = -90 deg)
      // Local Normal (nx, ny, nz) -> World Normal
      // But we are setting the attribute for the mesh which is rotated.
      // So we need the normal in the MESH's local space.
      // Mesh local space: X=Right, Y=Up (relative to plane), Z=Forward (relative to plane)
      // Our calculated normal is in World Space (where Y is Up).
      // We need to inverse rotate it.
      // Rotate X +90 deg.
      // World (x, y, z) -> Local (x, z, -y)
      // Wait.
      // Mesh Rotation: X = -90.
      // Local Y -> World Z? No.
      // Local Z -> World Y? No.
      // Let's visualize:
      // Plane starts Flat in XY. Normal is (0, 0, 1).
      // Rotate -90 X.
      // Plane is now Flat in XZ. Normal is (0, 1, 0).
      // So Local (0, 0, 1) becomes World (0, 1, 0).
      // So Local Z corresponds to World Y.
      // Local Y corresponds to World -Z.
      // Local X corresponds to World X.

      // We have World Normal (wx, wy, wz).
      // We want Local Normal (lx, ly, lz).
      // lx = wx
      // lz = wy
      // ly = -wz

      // Let's verify:
      // If World Normal is Up (0, 1, 0).
      // lx = 0, lz = 1, ly = 0. -> (0, 0, 1). Correct (Plane default normal).

      geometry.attributes.normal.setXYZ(i, normal.x, -normal.z, normal.y);
    }

    // geometry.computeVertexNormals(); // Removed to avoid seams

    // Rotate to be flat on the ground (PlaneGeometry is XY, we want XZ)
    // But wait, if we rotate the mesh, the local coordinates change.
    // Let's keep the mesh rotation logic simple:
    // PlaneGeometry defaults to facing +Z. 
    // We want it to be the ground, so we rotate -90 deg around X.
    // Then local Z becomes world Y (up).
    // So setting Z in the buffer attribute corresponds to height.

    const material = new THREE.MeshStandardMaterial({
      color: 0x228B22,
      flatShading: true,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, this.zOffset + TerrainChunk.CHUNK_SIZE / 2);

    return mesh;
  }

  private generateWater(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      TerrainChunk.CHUNK_WIDTH,
      TerrainChunk.CHUNK_SIZE,
      TerrainChunk.RESOLUTION,
      TerrainChunk.RESOLUTION
    );

    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);
      const worldZ = (this.zOffset + TerrainChunk.CHUNK_SIZE / 2) - vertex.y;
      const offset = this.getRiverOffset(worldZ);
      positions.setX(i, vertex.x + offset);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, this.zOffset + TerrainChunk.CHUNK_SIZE / 2);

    return mesh;
  }

  private calculateHeight(x: number, z: number): number {
    // 1. River Channel Profile
    // 0 at center, rising to banks
    const riverMask = Math.abs(x) < TerrainChunk.RIVER_WIDTH / 2 ? 0 : 1;

    // Smooth transition for river bank
    // Sigmoid or smoothstep function to create a bank
    const bankWidth = 10;
    const distFromCenter = Math.abs(x);
    const riverEdge = TerrainChunk.RIVER_WIDTH / 2;

    let baseHeight = 0;

    if (distFromCenter < riverEdge) {
      // Underwater / River bed
      // Parabola: y = a*x^2 - depth
      const depth = 5;
      const normalizedX = distFromCenter / riverEdge;
      baseHeight = -depth * (1 - normalizedX * normalizedX);
    } else {
      // Land
      // Start at 0 and go up
      // Smooth transition
      const distFromBank = distFromCenter - riverEdge;
      const bankHeight = 2.0; // Immediate bank height

      // Noise for terrain
      // Low frequency, high amplitude for mountains
      // High frequency, low amplitude for detail
      const noise1 = this.noise.noise2D(x * 0.02, z * 0.02) * 10;
      const noise2 = this.noise.noise2D(x * 0.1, z * 0.1) * 2;

      // Biome factor: further out = higher mountains
      const mountainFactor = Math.min(1.0, distFromBank / 50.0);

      baseHeight = bankHeight + (noise1 + noise2) * mountainFactor;

      // Ensure land is never below water level (0)
      if (baseHeight < 0.5) baseHeight = 0.5;
    }

    return baseHeight;
  }

  private generateCollision() {
    // We need to find the shoreline.
    // Since our river is roughly straight and defined by x, 
    // we can approximate the collision by creating walls along the river banks.
    // However, the requirement is "intersecting the mesh you generate with the plane".

    // A robust way: iterate through grid cells, find where height crosses 0.
    // For this task, since we have a function calculateHeight, we can find the exact X where height = 0.
    // But the mesh is discrete.

    // Let's iterate through the rows of the mesh (along Z)
    // For each Z row, find the X values where the terrain goes from < 0 to > 0.

    const positions = this.mesh.geometry.attributes.position;
    const widthSegments = TerrainChunk.RESOLUTION;
    const heightSegments = TerrainChunk.RESOLUTION;

    // PlaneGeometry vertices are ordered row by row.
    // Row 0 is bottom (min y/z), Row N is top.
    // In each row, vertices go left to right (min x to max x).

    const leftBankPoints: Matter.Vector[] = [];
    const rightBankPoints: Matter.Vector[] = [];

    // We only need to check the "inner" part where the river is expected.
    // But let's scan the whole row to be safe.

    for (let iz = 0; iz <= heightSegments; iz++) {
      // Get Z coordinate for this row in world space
      // The mesh is positioned at zOffset + size/2, but that's the center.
      // Local y goes from -height/2 to +height/2
      const vRow = iz * (widthSegments + 1);

      // We need world Z for this row.
      // In local space (before rotation), y is the "up" direction of the plane, which becomes -Z in world after rotation?
      // Wait, PlaneGeometry(w, h):
      // x: -w/2 to w/2
      // y: h/2 to -h/2 (usually top to bottom in texture coords, but geometry might be bottom to top)
      // Let's check Three.js docs or assume standard:
      // It builds from top-left usually? Or bottom-left?
      // Actually, let's just use the vertex data directly.

      // We need to find the transition from water (z < 0) to land (z > 0)
      // Note: In the mesh geometry, 'z' attribute is the height.

      let foundLeft = false;
      let foundRight = false;

      for (let ix = 0; ix < widthSegments; ix++) {
        const idx = vRow + ix;
        const idxNext = idx + 1;

        const h1 = positions.getZ(idx);
        const h2 = positions.getZ(idxNext);

        const x1 = positions.getX(idx);
        const x2 = positions.getX(idxNext);

        // Check for zero crossing
        if ((h1 < 0 && h2 >= 0) || (h1 >= 0 && h2 < 0)) {
          // Linear interpolation to find exact x where h=0
          const t = (0 - h1) / (h2 - h1);
          const xZero = x1 + t * (x2 - x1);

          // The Y coordinate in the geometry corresponds to world Z (relative to chunk center)
          // But we need absolute world Z.
          // The mesh is at this.zOffset + CHUNK_SIZE/2
          // The geometry Y is relative to that.
          const yGeo = positions.getY(idx);
          // After rotation x=-90, local (x, y, z) -> world (x, z, -y) ?
          // Mesh rotation x = -PI/2:
          // Local X -> World X
          // Local Y -> World -Z  (if Y is up) OR World Z?
          // Let's visualize: 
          // Default Plane is in XY plane. Normal is +Z.
          // Rotate -90 deg X:
          // Top of plane (Y+) points into screen (Z-).
          // Normal (+Z) points Up (Y+).
          // So Local Y corresponds to World -Z.

          // Actually, let's just use the mesh's transformation.
          // But we need the points for Matter.js which is 2D (X, Y=World Z).
          // Wait, Matter.js usually uses X and Y.
          // In our game, Boat is (x, y). 
          // 3D World: x is x, z is y. (Top down view).
          // So we need (WorldX, WorldZ).

          // Local Y in plane geometry corresponds to World -Z (roughly).
          // Let's calculate World Z properly.
          // The mesh is positioned at Z_center.
          // Local Y ranges from -Size/2 to +Size/2.
          // If we rotate -90 X:
          // Y axis maps to -Z axis.
          // So WorldZ = MeshZ + (-LocalY) = MeshZ - LocalY.

          const worldZ = (this.zOffset + TerrainChunk.CHUNK_SIZE / 2) - yGeo;

          // xZero is already in world space because x1 and x2 are from the mesh which has offsets applied.
          const worldX = xZero;

          if (xZero < 0) {
            if (!foundLeft) {
              leftBankPoints.push({ x: worldX, y: worldZ });
              foundLeft = true;
            }
          } else {
            if (!foundRight) {
              rightBankPoints.push({ x: worldX, y: worldZ });
              foundRight = true;
            }
          }
        }
      }
    }

    // Create bodies from points
    if (leftBankPoints.length > 1) {
      this.createWallBody(leftBankPoints);
    }
    if (rightBankPoints.length > 1) {
      this.createWallBody(rightBankPoints);
    }
  }

  private createWallBody(points: Matter.Vector[]) {
    // Matter.js bodies from vertices need to be convex or we use a compound body.
    // A long chain of vertices is not necessarily convex.
    // However, we can use `Matter.Bodies.fromVertices` which decomposes it, 
    // OR we can just create a chain of edges (rectangles) or circles.
    // For a shore, a static chain of edges is best? 
    // Matter.js doesn't have a built-in "Chain" body type like Box2D.
    // We usually approximate with a compound body of thick lines (rectangles).

    const parts: Matter.Body[] = [];
    const thickness = 10;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      const wall = Matter.Bodies.rectangle(cx, cy, len + 2, thickness, {
        isStatic: true,
        angle: angle,
        label: 'Shore'
      });

      parts.push(wall);
    }

    if (parts.length > 0) {
      // We can add them individually to the world, no need to compound them if they are static.
      // Compounding static bodies is sometimes worse for performance if the hull is huge.
      // Let's just add them to our list.
      this.bodies.push(...parts);
    }
  }

  dispose() {
    this.graphicsEngine.remove(this.mesh);
    this.graphicsEngine.remove(this.waterMesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.waterMesh.geometry.dispose();
    (this.waterMesh.material as THREE.Material).dispose();

    this.bodies.forEach(body => this.physicsEngine.removeBody(body));
    this.bodies = [];
  }
}
