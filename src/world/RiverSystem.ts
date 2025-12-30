import { SimplexNoise } from './SimplexNoise';
import { BiomeManager } from './BiomeManager';
import { BiomeType } from './biomes/BiomeType';
import { TerrainGeometry } from './TerrainGeometry';

export interface RiverGeometrySample {
  centerPos: { x: number, z: number };
  tangent: { x: number, z: number };
  normal: { x: number, z: number }; // Points to the right bank
  leftBankDist: number;   // Distance to left bank along the normal vector
  rightBankDist: number;  // Distance to right bank along the normal vector
  arcLength: number;      // Cumulative arc length from some start point
}

export class RiverSystem {
  private static instance: RiverSystem;

  private noise: SimplexNoise;

  // Configuration
  private readonly PATH_SCALE = 0.002; // 500 units wavelength
  private readonly PATH_AMPLITUDE = 100;

  private readonly WIDTH_SCALE = 0.002; // Frequency of width changes

  public readonly MIN_WIDTH = 15; // Was 30
  public readonly MAX_WIDTH = 75; // Was 150

  public biomeManager: BiomeManager;
  public terrainGeometry: TerrainGeometry;

  private constructor() {
    this.noise = new SimplexNoise(100);
    this.biomeManager = new BiomeManager();
    this.terrainGeometry = new TerrainGeometry(this);
  }

  public static getInstance(): RiverSystem {
    if (!RiverSystem.instance) {
      RiverSystem.instance = new RiverSystem();
    }
    return RiverSystem.instance;
  }

  /**
   * Returns the X coordinate of the river center at a given Z position.
   */
  public getRiverCenter(worldZ: number): number {
    return this.noise.noise2D(0, worldZ * this.PATH_SCALE) * this.PATH_AMPLITUDE;
  }

  /**
   * Returns the derivative (slope) of the river center at z.
   * Useful for determining the tangent/normal vector of the bank.
   */
  public getRiverDerivative(worldZ: number): number {
    const epsilon = 1.0;
    const x1 = this.getRiverCenter(worldZ - epsilon);
    const x2 = this.getRiverCenter(worldZ + epsilon);
    return (x2 - x1) / (2 * epsilon); // dx/dz
  }

  /**
   * Returns the width of the river at a given Z position.
   */
  public getRiverWidth(worldZ: number): number {
    // 1. Biome Noise: Determines if we are in a wide or narrow section
    // Normalized to 0..1
    const biomeNoise = (this.noise.noise2D(100, worldZ * this.WIDTH_SCALE) + 1) / 2;

    // Interpolate between Min and Max based on biome
    let baseWidth = this.lerp(this.MIN_WIDTH, this.MAX_WIDTH, biomeNoise);
    const widthMultiplier = this.biomeManager.getRiverWidthMultiplier(worldZ);

    // For ice biome, we previously had logic to widen it "deeper" into the biome.
    // The simple multiplier above is a good approximation, but let's refine if needed.
    // The user request for swamp is "~5x the default".

    return Math.max(15, baseWidth * widthMultiplier);
  }

  /**
   * Returns the X coordinates for the left and right banks.
   */
  public getBankPositions(worldZ: number): { left: number, right: number } {
    const center = this.getRiverCenter(worldZ);
    const width = this.getRiverWidth(worldZ);
    const halfWidth = width / 2;

    return {
      left: center - halfWidth,
      right: center + halfWidth
    };
  }

  /**
   * Calculates the distance to the water along a specific direction vector using ray marching.
   * Returns -1 if water is not found within a reasonable distance.
   */
  public getDistanceToWater(startPosition: { x: number, y: number }, direction: { x: number, y: number }): number {
    const stepSize = 1.0;
    const maxSteps = 200; // Look ahead up to 200 units

    let currentX = startPosition.x;
    let currentY = startPosition.y;
    let distTraveled = 0;

    // Normalizing direction is expected from caller, but let's be safe if we were to be strict. 
    // Ideally we assume direction is normalized.

    for (let i = 0; i < maxSteps; i++) {
      // Check if we are inside water at current position
      const banks = this.getBankPositions(currentY);

      // Use a small buffer to ensure we are "in" the water
      const buffer = 0.5;

      if (currentX > banks.left + buffer && currentX < banks.right - buffer) {
        // We found water
        return distTraveled;
      }

      // Advance
      currentX += direction.x * stepSize;
      currentY += direction.y * stepSize;
      distTraveled += stepSize;
    }

    return -1;
  }

  public getRiverGeometrySample(z: number, arcLength: number = 0): RiverGeometrySample {
    const x = this.getRiverCenter(z);
    const dx_dz = this.getRiverDerivative(z);

    // Tangent vector T = (dx/dz, 1) normalized
    const length = Math.sqrt(dx_dz * dx_dz + 1);
    const tangent = { x: dx_dz / length, z: 1 / length };

    // Normal vector N = (1, -dx/dz) normalized (pointing right-ish)
    const normal = { x: 1 / length, z: -dx_dz / length };

    // Iterative solver to find distance along normal to banks
    // Banks are at x_bank = getRiverCenter(z_bank) +/- getRiverWidth(z_bank)/2
    // returns distance d such that center + d * normal is on the target side
    const findBankDistance = (side: 1 | -1): number => {
      let d = side * this.getRiverWidth(z) / 2; // Initial guess
      const maxAttempts = 5;
      for (let i = 0; i < maxAttempts; i++) {
        const pz = z + d * normal.z;
        const px = x + d * normal.x;
        const center = this.getRiverCenter(pz);
        const halfWidth = this.getRiverWidth(pz) / 2;
        const targetX = center + side * halfWidth;

        // This is a simple iterative refinement.
        // We want px to match targetX.
        // The error is (px - targetX). We adjust d.
        const error = px - targetX;
        d -= error * normal.x;
      }
      return Math.abs(d);
    };

    const leftBankDist = findBankDistance(-1); // Side -1 is left
    const rightBankDist = findBankDistance(1);  // Side 1 is right

    return {
      centerPos: { x, z },
      tangent,
      normal,
      leftBankDist,
      rightBankDist,
      arcLength
    };
  }

  /**
   * Samples the river at regular arc length intervals.
   * Supports sampling in either Z direction.
   */
  public sampleRiver(zStart: number, zEnd: number, stepArcLength: number): RiverGeometrySample[] {
    const samples: RiverGeometrySample[] = [];
    const direction = zEnd > zStart ? 1 : -1;
    let currentZ = zStart;
    let accumulatedArcLength = 0;
    let nextSampleArcLengthTarget = 0;

    // Initial point
    samples.push(this.getRiverGeometrySample(currentZ, accumulatedArcLength));
    nextSampleArcLengthTarget += stepArcLength;

    const integrationStep = 1.0;

    while (direction > 0 ? currentZ < zEnd : currentZ > zEnd) {
      // Numerical integration of ds = sqrt(1 + (dx/dz)^2) |dz|
      const dx_dz = this.getRiverDerivative(currentZ);
      const ds = Math.sqrt(1 + dx_dz * dx_dz) * integrationStep;

      currentZ += integrationStep * direction;
      accumulatedArcLength += ds;

      if (accumulatedArcLength >= nextSampleArcLengthTarget) {
        samples.push(this.getRiverGeometrySample(currentZ, accumulatedArcLength));
        nextSampleArcLengthTarget += stepArcLength;
      }
    }

    return samples;
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
