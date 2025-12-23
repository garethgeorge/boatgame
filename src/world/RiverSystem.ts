import { SimplexNoise } from './SimplexNoise';
import { BiomeManager } from './BiomeManager';
import { BiomeType } from './biomes/BiomeType';
import { TerrainGeometry } from './TerrainGeometry';

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

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
