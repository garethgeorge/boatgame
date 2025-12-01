import * as planck from 'planck';
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
}
