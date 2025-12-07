import { SimplexNoise } from './SimplexNoise';
import { BiomeManager } from './BiomeManager';
import { TerrainGeometry } from './TerrainGeometry';

export class RiverSystem {
  private static instance: RiverSystem;

  private noise: SimplexNoise;

  // Configuration
  private readonly PATH_SCALE = 0.002; // 500 units wavelength
  private readonly PATH_AMPLITUDE = 100;

  private readonly WIDTH_SCALE = 0.002; // Frequency of width changes
  private readonly BANK_NOISE_SCALE = 0.002; // Frequency of bank jaggedness

  private readonly MIN_WIDTH = 15; // Was 30
  private readonly MAX_WIDTH = 75; // Was 150

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

    // Apply Swamp Modifier: Widen river significantly
    const mixture = this.biomeManager.getBiomeMixture(worldZ);
    const getWidthMultiplier = (biome: 'desert' | 'forest' | 'ice' | 'swamp') => {
      if (biome === 'swamp') return 5.0;
      if (biome === 'ice') return 4.0; // Ice biome also has wider rivers deep in
      return 1.0;
    };

    const widthMultiplier = getWidthMultiplier(mixture.biome1) * mixture.weight1 + getWidthMultiplier(mixture.biome2) * mixture.weight2;

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

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
