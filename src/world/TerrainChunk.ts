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
  private static readonly CHUNK_WIDTH = 400; // Width of world in X
  private static readonly RESOLUTION = 40; // Vertices per axis
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
      const bankHeight = 0.0; // Immediate bank height (0 for symmetry with water)

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
    // Analytical collision generation aligned with mesh resolution
    // We generate collision segments using the exact same Z-steps as the visual mesh.
    // We use analytical width to ensure perfect symmetry.

    const leftBankPoints: Matter.Vector[] = [];
    const rightBankPoints: Matter.Vector[] = [];
    const halfWidth = TerrainChunk.RIVER_WIDTH / 2;
    const buffer = 1.0; // Symmetric buffer

    // Iterate through the mesh rows (0 to RESOLUTION)
    for (let i = 0; i <= TerrainChunk.RESOLUTION; i++) {
      // Calculate world Z exactly as it maps to the mesh vertices
      const fraction = i / TerrainChunk.RESOLUTION;
      const z = fraction * TerrainChunk.CHUNK_SIZE;
      const worldZ = this.zOffset + z;

      const offset = this.getRiverOffset(worldZ);

      // Analytical positions
      // Left bank: -halfWidth + offset + buffer
      // Right bank: +halfWidth + offset - buffer
      const leftX = -halfWidth + offset + buffer;
      const rightX = halfWidth + offset - buffer;

      leftBankPoints.push({ x: leftX, y: worldZ });
      rightBankPoints.push({ x: rightX, y: worldZ });
    }

    // Create bodies from points
    if (leftBankPoints.length > 1) {
      this.createContinuousWallBody(leftBankPoints, -1);
    }
    if (rightBankPoints.length > 1) {
      this.createContinuousWallBody(rightBankPoints, 1);
    }
  }

  private createContinuousWallBody(points: Matter.Vector[], side: number) {
    // side: -1 for left bank (expand to -x), 1 for right bank (expand to +x)
    const thickness = 10;
    const parts: Matter.Body[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Create a quad for this segment
      // Inner points: p1, p2
      // Outer points: p1 + thickness, p2 + thickness (roughly)

      // We want the wall to extend "outwards" from the river.
      // Left bank (side -1): inner is at x, outer should be at x - thickness
      // Right bank (side 1): inner is at x, outer should be at x + thickness

      // Ensure Counter-Clockwise (CCW) winding for Matter.js
      let vertices: { x: number, y: number }[];

      if (side === 1) {
        // Right bank: Inner -> Outer
        // p1 -> p2 -> p2_out -> p1_out
        // (x, z) -> (x, z+dz) -> (x+th, z+dz) -> (x+th, z)
        // This is CCW.
        vertices = [
          { x: p1.x, y: p1.y },
          { x: p2.x, y: p2.y },
          { x: p2.x + side * thickness, y: p2.y },
          { x: p1.x + side * thickness, y: p1.y }
        ];
      } else {
        // Left bank (side -1): Inner -> Outer
        // p1 -> p2 -> p2_out -> p1_out
        // (x, z) -> (x, z+dz) -> (x-th, z+dz) -> (x-th, z)
        // This is Clockwise (CW).
        // We need CCW: p1 -> p1_out -> p2_out -> p2
        vertices = [
          { x: p1.x, y: p1.y },
          { x: p1.x + side * thickness, y: p1.y },
          { x: p2.x + side * thickness, y: p2.y },
          { x: p2.x, y: p2.y }
        ];
      }

      // Calculate center for the body
      // IMPORTANT: We must use the exact centroid calculated by Matter.js
      // otherwise Matter.js will shift the vertices when creating the body.
      const center = Matter.Vertices.centre(vertices);

      // Create a part for this segment.
      // Note: We don't set isStatic here, we set it on the parent body.
      const part = Matter.Bodies.fromVertices(center.x, center.y, [vertices], {
        restitution: 0.0,
        friction: 0.0,
        frictionStatic: 0.0
      });

      if (part) {
        parts.push(part);
      }
    }

    if (parts.length > 0) {
      // Create a single compound body from all parts
      // This ensures internal edges are ignored for collision, preventing snagging.
      const compoundBody = Matter.Body.create({
        parts: parts,
        isStatic: true,
        label: 'Shore',
        restitution: 0.0,
        friction: 0.0,
        frictionStatic: 0.0
      });

      this.bodies.push(compoundBody);
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
