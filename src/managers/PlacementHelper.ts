import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../world/RiverSystem';

export interface PlacementOptions {
  minDistFromOthers?: number;
  avoidCenter?: boolean;
  bias?: 'left' | 'right' | 'center' | 'none';
  biasStrength?: number; // 0 to 1
  minDistFromBank?: number;
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
    options: PlacementOptions = {}
  ): { x: number, z: number } | null {
    const maxAttempts = 20;
    const minDistFromBank = options.minDistFromBank || 2.0;
    const minDistFromOthers = options.minDistFromOthers || 2.0;

    for (let i = 0; i < maxAttempts; i++) {
      // Random Z
      const z = zMin + Math.random() * (zMax - zMin);

      // Get River Bounds
      const center = this.riverSystem.getRiverCenter(z);
      const width = this.riverSystem.getRiverWidth(z);

      // Calculate safe width (accounting for object radius and bank buffer)
      const safeHalfWidth = (width / 2) - radius - minDistFromBank;

      if (safeHalfWidth <= 0) continue; // River too narrow for this object

      // Random X within safe bounds
      let xOffset = (Math.random() - 0.5) * 2 * safeHalfWidth;

      // Apply Bias
      if (options.bias === 'left') {
        // Bias towards negative X (relative to center)
        if (Math.random() < (options.biasStrength || 0.5)) {
          xOffset = -Math.abs(xOffset);
        }
      } else if (options.bias === 'right') {
        // Bias towards positive X
        if (Math.random() < (options.biasStrength || 0.5)) {
          xOffset = Math.abs(xOffset);
        }
      } else if (options.avoidCenter) {
        // Push away from center
        if (Math.abs(xOffset) < safeHalfWidth * 0.3) {
          xOffset = (xOffset > 0 ? 1 : -1) * (safeHalfWidth * (0.3 + Math.random() * 0.7));
        }
      }

      const x = center + xOffset;

      // Check collision with other placed objects
      let collision = false;
      for (const obj of this.placedObjects) {
        const dx = x - obj.x;
        const dz = z - obj.z;
        const distSq = dx * dx + dz * dz;
        const minSep = radius + obj.radius + minDistFromOthers;

        if (distSq < minSep * minSep) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        // Valid placement found
        this.placedObjects.push({ x, z, radius });
        return { x, z };
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
    minDistFromBank: number,
    variableDistFromBank: number,
    maxSlopeDegrees: number = 20
  ): ShorePlacement | null {
    // Random Z position in chunk
    const worldZ = zStart + Math.random() * (zEnd - zStart);

    const riverWidth = riverSystem.getRiverWidth(worldZ);
    const riverCenter = riverSystem.getRiverCenter(worldZ);
    const isLeftBank = Math.random() > 0.5;
    const distFromBank = minDistFromBank + Math.random() * variableDistFromBank;
    const localX = (isLeftBank ? -1 : 1) * (riverWidth / 2 + distFromBank);
    const worldX = localX + riverCenter;
    const height = riverSystem.terrainGeometry.calculateHeight(worldX, worldZ);

    // Check slope
    const normal = riverSystem.terrainGeometry.calculateNormal(worldX, worldZ);
    const up = new THREE.Vector3(0, 1, 0);
    if (normal.angleTo(up) > THREE.MathUtils.degToRad(maxSlopeDegrees)) {
      return null;
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
}

export interface ShorePlacement {
  worldX: number;
  worldZ: number;
  height: number;
  rotation: number;
  normal: THREE.Vector3;
}
