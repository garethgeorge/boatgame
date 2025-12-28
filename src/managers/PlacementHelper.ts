import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../world/RiverSystem';



export interface RiverPlacementOptions {
  minDistFromOthers?: number;
  avoidCenter?: boolean;
  center?: number;    // -1 (left) to 1 (right)
  variation?: number; // 0 to 1
  minDistFromBank?: number;
}

export interface ShorePlacementOptions {
  minDistFromBank?: number;
  maxDistFromBank?: number;
  maxSlopeDegrees?: number;
  side?: number; // negative for left, positive for right, abs() is probability
}

interface PlacedObject {
  x: number;
  z: number;
  radius: number;
}

export class PlacementHelper {
  private placedObjects: PlacedObject[] = [];
  private riverSystem: RiverSystem;

  constructor() {
    this.riverSystem = RiverSystem.getInstance();
  }

  /**
   * Try to find a valid position for an object with the given radius within the Z range.
   */
  public tryPlace(
    zMin: number,
    zMax: number,
    radius: number,
    options: RiverPlacementOptions = {}
  ): { x: number, z: number } | null {
    const maxAttempts = 20;
    const minDistFromBank = options.minDistFromBank || 2.0;
    const minDistFromOthers = options.minDistFromOthers || 2.0;

    for (let i = 0; i < maxAttempts; i++) {
      // Random Z
      const worldZ = zMin + Math.random() * (zMax - zMin);

      // Get River Bounds
      const riverCenter = this.riverSystem.getRiverCenter(worldZ);
      const width = this.riverSystem.getRiverWidth(worldZ);

      // Calculate safe width (accounting for object radius and bank buffer)
      const safeHalfWidth = (width / 2) - radius - minDistFromBank;

      if (safeHalfWidth <= 0) continue; // River too narrow for this object

      let minX = -safeHalfWidth;
      let maxX = safeHalfWidth;

      const center = options.center !== undefined ? options.center : 0;
      const variation = options.variation !== undefined ? options.variation : 1.0;

      const centerOffset = safeHalfWidth * center;
      const variability = (safeHalfWidth - Math.abs(centerOffset)) * variation;

      minX = centerOffset - variability;
      maxX = centerOffset + variability;

      let xOffset = minX + Math.random() * (maxX - minX);

      // Special handling for avoidCenter (can be combined with bias or used alone)
      if (options.avoidCenter) {
        // If xOffset is too close to center, push it to the edges of the allowed [minX, maxX] range
        const centerThreshold = (maxX - minX) * 0.15;
        if (Math.abs(xOffset) < centerThreshold) {
          xOffset = xOffset > 0 ? maxX : minX;
        }
      }

      const x = riverCenter + xOffset;

      // Check collision with other placed objects
      let collision = false;
      for (const obj of this.placedObjects) {
        const dx = x - obj.x;
        const dz = worldZ - obj.z;
        const distSq = dx * dx + dz * dz;
        const minSep = radius + obj.radius + minDistFromOthers;

        if (distSq < minSep * minSep) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        // Valid placement found
        this.placedObjects.push({ x, z: worldZ, radius });
        return { x, z: worldZ };
      }
    }

    return null;
  }

  /**
   * Register an object that was placed manually (e.g. chained buoys) so others avoid it.
   */
  public registerPlacement(x: number, z: number, radius: number) {
    this.placedObjects.push({ x, z, radius });
  }

  public findShorePlacement(
    zStart: number,
    zEnd: number,
    riverSystem: RiverSystem,
    options: ShorePlacementOptions
  ): ShorePlacement | null {
    const { minDistFromBank, maxDistFromBank, maxSlopeDegrees = 20 } = options;

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Random Z position in chunk
      const worldZ = zStart + Math.random() * (zEnd - zStart);

      const riverWidth = riverSystem.getRiverWidth(worldZ);
      const riverCenter = riverSystem.getRiverCenter(worldZ);

      // Bank selection based on side
      let isLeftBank: boolean;
      const side = options.side || 0;

      if (side < 0) {
        // Favor left bank
        isLeftBank = Math.random() < Math.abs(side);
      } else if (side > 0) {
        // Favor right bank
        isLeftBank = Math.random() > Math.abs(side);
      } else {
        // Neutral
        isLeftBank = Math.random() > 0.5;
      }

      const distFromBank = (minDistFromBank || 0) + ((maxDistFromBank || 0) - (minDistFromBank || 0)) * Math.random();
      const localX = (isLeftBank ? -1 : 1) * (riverWidth / 2 + distFromBank);
      const worldX = localX + riverCenter;
      const height = riverSystem.terrainGeometry.calculateHeight(worldX, worldZ);

      // Check slope
      const normal = riverSystem.terrainGeometry.calculateNormal(worldX, worldZ);
      const up = new THREE.Vector3(0, 1, 0);
      if (normal.angleTo(up) > THREE.MathUtils.degToRad(maxSlopeDegrees)) {
        continue;
      }

      // Rotate around normal to face water with +/- 45 degrees variation
      const riverDerivative = riverSystem.getRiverDerivative(worldZ);
      const riverAngle = Math.atan(riverDerivative);
      let baseAngle = isLeftBank ? -Math.PI / 2 : Math.PI / 2;
      baseAngle += riverAngle;

      // Add random variation between -45 and +45 degrees (PI/4)
      baseAngle += (Math.random() - 0.5) * (Math.PI / 2);

      return {
        worldX,
        worldZ,
        height,
        rotation: baseAngle,
        normal
      };
    }

    return null;
  }
}

export interface ShorePlacement {
  worldX: number;
  worldZ: number;
  height: number;
  rotation: number;
  normal: THREE.Vector3;
}
