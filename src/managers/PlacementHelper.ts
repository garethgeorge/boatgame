import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../world/RiverSystem';
import { RiverGeometrySample } from '../world/RiverGeometry';



export interface RiverPlacementOptions {
  minDistFromOthers?: number;
  range?: [number, number];   // [min, max] as multiples of safeHalfWidth, -1 to 1
  avoidCenter?: number;        // Fraction of the range to "hole out" in the middle
  minDistFromBank?: number;
}

export interface ShorePlacementOptions {
  minDistFromBank?: number;
  maxDistFromBank?: number;
  maxSlopeDegrees?: number;
  side?: number; // negative for left, positive for right, abs() is probability
}

export interface ShorePlacement {
  worldX: number;
  worldZ: number;
  height: number;
  rotation: number;
  normal: THREE.Vector3;
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

      const safeHalfWidth = (width / 2) - radius - minDistFromBank;
      if (safeHalfWidth <= 0) continue; // River too narrow for this object
      const range = options.range || [-1, 1];
      const minX = safeHalfWidth * range[0];
      const maxX = safeHalfWidth * range[1];

      const rangeCenter = (minX + maxX) / 2;
      const rangeHalfWidth = (maxX - minX) / 2;

      let xOffset: number;
      if (options.avoidCenter && options.avoidCenter > 0) {
        const holeHalfWidth = rangeHalfWidth * options.avoidCenter;
        const holeMin = rangeCenter - holeHalfWidth;
        const holeMax = rangeCenter + holeHalfWidth;

        const leftWidth = holeMin - minX;
        const rightWidth = maxX - holeMax;
        const totalEffectiveWidth = leftWidth + rightWidth;

        if (totalEffectiveWidth <= 0) continue;

        const rand = Math.random() * totalEffectiveWidth;
        if (rand < leftWidth) {
          xOffset = minX + rand;
        } else {
          xOffset = holeMax + (rand - leftWidth);
        }
      } else {
        xOffset = minX + Math.random() * (maxX - minX);
      }

      const x = riverCenter + xOffset;

      // Check collision with other placed objects
      const collision = this.checkCollision(x, worldZ, radius, minDistFromOthers);
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

  public tryRiverPlaceAbsolute(
    sample: RiverGeometrySample,
    radius: number,
    minSpacing: number,
    minDistFromShore: number,
    distanceRange: [number, number]
  ): { worldX: number, worldZ: number } | null {
    const maxAttempts = 10;

    for (let i = 0; i < maxAttempts; i++) {
      const d = distanceRange[0] + Math.random() * (distanceRange[1] - distanceRange[0]);

      // Ensure distance is within river banks plus spacing
      if (Math.abs(d) > sample.bankDist - minDistFromShore) {
        continue;
      }

      const worldX = sample.centerPos.x + d * sample.normal.x;
      const worldZ = sample.centerPos.z + d * sample.normal.z;

      if (this.checkCollision(worldX, worldZ, radius, minSpacing)) continue;

      this.placedObjects.push({ x: worldX, z: worldZ, radius });
      return { worldX, worldZ };
    }

    return null;
  }

  public tryShorePlaceAbsolute(
    sample: RiverGeometrySample,
    radius: number,
    minSpacing: number,
    minDistFromShore: number,
    distanceRange: [number, number],
    maxSlopeDegrees: number
  ): ShorePlacement | null {
    const maxAttempts = 10;

    for (let i = 0; i < maxAttempts; i++) {
      const d = distanceRange[0] + Math.random() * (distanceRange[1] - distanceRange[0]);

      // Ensure distance is on shore plus spacing
      if (Math.abs(d) < sample.bankDist + minDistFromShore) {
        continue;
      }

      const worldX = sample.centerPos.x + d * sample.normal.x;
      const worldZ = sample.centerPos.z + d * sample.normal.z;

      // Check slope
      const height = this.riverSystem.terrainGeometry.calculateHeight(worldX, worldZ);
      const normal = this.riverSystem.terrainGeometry.calculateNormal(worldX, worldZ);
      const up = new THREE.Vector3(0, 1, 0);
      if (normal.angleTo(up) > THREE.MathUtils.degToRad(maxSlopeDegrees)) {
        continue;
      }

      // Check collision
      if (this.checkCollision(worldX, worldZ, radius, minSpacing)) continue;

      // Calculate rotation (facing the river)
      const riverAngle = Math.atan2(sample.tangent.x, sample.tangent.z);
      // d < 0 is left bank, should face right (PI/2)
      // d > 0 is right bank, should face left (-PI/2)
      let rotation = (d > 0) ? Math.PI / 2 : -Math.PI / 2;
      rotation += riverAngle;
      rotation += (Math.random() - 0.5) * (Math.PI / 2);

      const placement: ShorePlacement = {
        worldX,
        worldZ,
        height,
        rotation,
        normal
      };
      this.placedObjects.push({ x: worldX, z: worldZ, radius });
      return placement;
    }

    return null;
  }

  private checkCollision(x: number, z: number, radius: number, minSpacing: number): boolean {
    for (const obj of this.placedObjects) {
      const dx = x - obj.x;
      const dz = z - obj.z;
      const distSq = dx * dx + dz * dz;
      const minSep = radius + obj.radius + minSpacing;
      if (distSq < minSep * minSep) return true;
    }
    return false;
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
      let baseAngle = isLeftBank ? Math.PI / 2 : -Math.PI / 2;
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
