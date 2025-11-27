import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';
import { GraphicsEngine } from '../core/GraphicsEngine';

export class TerrainChunk {
  mesh: THREE.Mesh;
  waterMesh: THREE.Mesh;

  // Config
  private static readonly CHUNK_SIZE = 500; // Size of chunk in Z
  private static readonly CHUNK_WIDTH = 400; // Width of world in X
  private static readonly RESOLUTION_X = 40; // Vertices along X
  private static readonly RESOLUTION_Z = 200; // Vertices along Z
  private static readonly RIVER_WIDTH = 40;

  constructor(
    private zOffset: number,
    private graphicsEngine: GraphicsEngine,
    private noise: SimplexNoise
  ) {
    this.mesh = this.generateMesh();
    this.waterMesh = this.generateWater();

    this.graphicsEngine.add(this.mesh);
    this.graphicsEngine.add(this.waterMesh);
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

    const nx = -dhdx;
    const ny = 1;
    const nz = dhdx * doffdz - dhdz;

    return new THREE.Vector3(nx, ny, nz).normalize();
  }

  private generateMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      TerrainChunk.CHUNK_WIDTH,
      TerrainChunk.CHUNK_SIZE,
      TerrainChunk.RESOLUTION_X,
      TerrainChunk.RESOLUTION_Z
    );

    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i);

      // Transform to world space for noise sampling
      const worldX = vertex.x;
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
      geometry.attributes.normal.setXYZ(i, normal.x, -normal.z, normal.y);
    }

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
      TerrainChunk.RESOLUTION_X,
      TerrainChunk.RESOLUTION_Z
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
  }
}
