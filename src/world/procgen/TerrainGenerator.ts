import * as THREE from 'three';
import Matter from 'matter-js';
import { RiverSystem, RiverSegment } from './RiverSystem';
import { createNoise2D } from 'simplex-noise';

export class TerrainGenerator {
  riverSystem: RiverSystem;
  noise2D = createNoise2D();

  constructor(riverSystem: RiverSystem) {
    this.riverSystem = riverSystem;
  }

  // Smooth Minimum Function
  smin(a: number, b: number, k: number): number {
    const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k));
    return b + (a - b) * h - k * h * (1.0 - h);
  }

  getTerrainHeight(worldPos: THREE.Vector3): number {
    // 1. Find nearest segments
    const nearbySegments = this.riverSystem.getNearestSegments(worldPos, 100);

    let minDistance = Infinity;

    // Find distance to nearest river centerline
    for (const seg of nearbySegments) {
      const d = seg.getDistanceToCenterline(worldPos);
      // Use smin to blend distances if multiple segments are close?
      // Actually, we want the distance to the NEAREST river.
      // But blending the "valley" shape requires blending the distances or the heights.
      // Blending heights is better.
      if (d < minDistance) minDistance = d;
    }

    if (minDistance === Infinity) return 10; // Default height if far

    // 2. Base Valley Shape
    const riverWidth = 20; // Half-width actually
    const valleySteepness = 0.02;
    const riverDepth = 5;

    // Parabola: y = x^2
    // We want flat bottom at riverWidth.
    // If d < riverWidth, height = -riverDepth
    // If d > riverWidth, height rises

    let baseHeight = 0;
    if (minDistance < riverWidth) {
      baseHeight = -riverDepth;
    } else {
      const d = minDistance - riverWidth;
      baseHeight = d * d * valleySteepness;
    }

    // 3. Noise
    const noiseScale = 0.1;
    const noiseVal = this.noise2D(worldPos.x * noiseScale, worldPos.z * noiseScale);

    // Extremeness mask: More noise further away
    const extremeness = Math.max(0, (minDistance - riverWidth) * 0.1);

    return baseHeight + noiseVal * extremeness;
  }

  generateMesh(segment: RiverSegment): THREE.Mesh {
    // Generate "Snake Mesh" along the spline
    const curve = segment.curve;
    const points = curve.getSpacedPoints(50); // Resolution along river
    const width = 100; // Total width of terrain strip
    const resolutionV = 10; // Resolution across river

    // Fix: Swap widthSegments and heightSegments to match the loop structure
    // widthSegments = resolutionV (lateral), heightSegments = points.length - 1 (longitudinal)
    // This ensures the stride matches index = i * (resolutionV + 1) + j
    const geometry = new THREE.PlaneGeometry(1, 1, resolutionV, points.length - 1);
    const posAttribute = geometry.attributes.position;
    const uvAttribute = geometry.attributes.uv;

    // We need to manually position vertices
    // For each point on spline, create a ring (or line) of vertices perpendicular to tangent

    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1);
      const point = points[i];
      const tangent = curve.getTangent(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize(); // Perpendicular in XZ plane

      for (let j = 0; j <= resolutionV; j++) {
        const v = j / resolutionV; // 0 to 1
        const offset = (v - 0.5) * width; // -width/2 to +width/2

        const vertexPos = point.clone().add(normal.clone().multiplyScalar(offset));

        // Sample height
        vertexPos.y = this.getTerrainHeight(vertexPos);

        // Update geometry
        // Index: i * (resolutionV + 1) + j
        const index = i * (resolutionV + 1) + j;
        posAttribute.setXYZ(index, vertexPos.x, vertexPos.y, vertexPos.z);

        // UVs
        // U = progress along river (scaled for texture repeat)
        // V = progress across river
        // For flow map, we might want world space or river space.
        // Let's stick to simple UVs for now, but scale U by length.
        const length = curve.getLength();
        uvAttribute.setXY(index, t * (length / 20), v);
      }
    }

    geometry.computeVertexNormals();

    // Custom shader material for flow mapping could be added here
    // For now, standard material with vertex colors or texture
    const material = new THREE.MeshStandardMaterial({
      color: 0x228B22,
      wireframe: false,
      side: THREE.DoubleSide,
      flatShading: true
    });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  generateCollision(segment: RiverSegment): Matter.Body[] {
    // Generate static bodies for the banks
    // We can approximate with a series of rectangles along the edges
    const bodies: Matter.Body[] = [];
    const curve = segment.curve;
    const points = curve.getSpacedPoints(20); // Lower res for physics
    const riverWidth = 40; // Total width (20 half-width)

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Midpoint
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const tangent = p2.clone().sub(p1).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const length = p1.distanceTo(p2);
      const angle = Math.atan2(tangent.z, tangent.x); // Angle in 2D (X, Z)

      // Left Bank
      const leftPos = mid.clone().add(normal.clone().multiplyScalar(-riverWidth / 2 - 5)); // 5 units thickness offset
      const leftBody = Matter.Bodies.rectangle(leftPos.x, leftPos.z, length, 10, {
        isStatic: true,
        angle: angle,
        label: 'Shore'
      });
      bodies.push(leftBody);

      // Right Bank
      const rightPos = mid.clone().add(normal.clone().multiplyScalar(riverWidth / 2 + 5));
      const rightBody = Matter.Bodies.rectangle(rightPos.x, rightPos.z, length, 10, {
        isStatic: true,
        angle: angle,
        label: 'Shore'
      });
      bodies.push(rightBody);
    }

    return bodies;
  }
}
