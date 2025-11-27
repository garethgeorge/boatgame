import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';
import { GraphicsEngine } from '../core/GraphicsEngine';

export class TerrainChunk {
  mesh: THREE.Mesh;
  waterMesh: THREE.Mesh;

  // Config
  private static readonly CHUNK_SIZE = 500; // Size of chunk in Z
  private static readonly CHUNK_WIDTH = 400; // Width of world in X
  private static readonly RESOLUTION_X = 160; // Vertices along X (Double fidelity perpendicular to river)
  private static readonly RESOLUTION_Z = 200; // Vertices along Z (Halve fidelity along river)
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

  private generateMesh(): THREE.Mesh {
    const geometry = this.createCustomGridGeometry();
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;

    for (let i = 0; i < positions.count; i++) {
      const localX = positions.getX(i);
      const localZ = positions.getZ(i); // This is 0 to CHUNK_SIZE

      // Transform to world space
      // Note: In generateMesh previously, we had:
      // worldZ = (this.zOffset + TerrainChunk.CHUNK_SIZE / 2) - vertex.y
      // PlaneGeometry was rotated -PI/2.
      // Here we are building upright geometry.
      // Let's align worldZ:
      const worldZ = this.zOffset + localZ;
      const worldX = localX;

      // Calculate height
      const height = this.calculateHeight(worldX, worldZ);
      positions.setY(i, height);

      // Apply river bending offset
      const offset = this.getRiverOffset(worldZ);
      positions.setX(i, localX + offset);

      // Calculate Normal
      const normal = this.calculateNormal(worldX, worldZ);
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }

    // No rotation needed if we build it Y-up
    // But we need to position the chunk correctly in Z
    // localZ is 0..CHUNK_SIZE.
    // We want the mesh to start at zOffset.
    // So mesh.position.z = zOffset?
    // Wait, we used worldZ = zOffset + localZ for noise.
    // So if mesh is at (0,0,0), vertices are at (x, y, zOffset + localZ).
    // But we set positions.z = localZ.
    // So we need to move mesh to zOffset.

    const material = new THREE.MeshStandardMaterial({
      color: 0x228B22,
      flatShading: true,
      side: THREE.DoubleSide
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

      const offset = this.getRiverOffset(worldZ);
      positions.setX(i, localX + offset);
      // Y is 0 by default
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, this.zOffset);

    return mesh;
  }

  private calculateHeight(x: number, z: number): number {
    // 1. River Channel Profile
    const riverEdge = TerrainChunk.RIVER_WIDTH / 2;
    const distFromCenter = Math.abs(x);

    if (distFromCenter < riverEdge) {
      // Underwater / River bed
      const depth = 5;
      const normalizedX = distFromCenter / riverEdge;
      return -depth * (1 - normalizedX * normalizedX);
    }

    // Land Generation
    const distFromBank = distFromCenter - riverEdge;

    // "Mountainous" Map: Low frequency noise to determine biome
    // 0 = Rolling Hills, 1 = Rugged Mountains
    // Scale: 0.001 (very large features)
    let mountainMask = this.noise.noise2D(x * 0.001, z * 0.001);
    mountainMask = (mountainMask + 1) / 2; // Normalize to 0-1
    mountainMask = Math.pow(mountainMask, 2); // Bias towards 0 (more hills than mountains)

    // Rolling Hills (Low Amplitude, Smooth)
    // FBM with low frequency
    const hillNoise =
      this.noise.noise2D(x * 0.01, z * 0.01) * 5 +
      this.noise.noise2D(x * 0.03, z * 0.03) * 2;

    // Rugged Mountains (High Amplitude, Ridged)
    // Ridged Multifractal: 1 - abs(noise)
    const ridge1 = 1 - Math.abs(this.noise.noise2D(x * 0.005, z * 0.005));
    const ridge2 = 1 - Math.abs(this.noise.noise2D(x * 0.01, z * 0.01));
    const mountainNoise = (Math.pow(ridge1, 2) * 40 + Math.pow(ridge2, 2) * 10);

    // Blend based on mask
    let terrainHeight = (hillNoise * (1 - mountainMask)) + (mountainNoise * mountainMask);

    // Add detail noise everywhere
    terrainHeight += this.noise.noise2D(x * 0.1, z * 0.1) * 1.0;

    // Transition from river bank
    // Ensure smooth transition from 0 at bank to full terrain height
    const bankTransition = Math.min(1.0, distFromBank / 30.0);
    const finalHeight = Math.max(0.5, terrainHeight * bankTransition);

    return finalHeight;
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
