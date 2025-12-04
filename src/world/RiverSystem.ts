import { SimplexNoise } from './SimplexNoise';
import { BiomeManager } from './BiomeManager';
import { TerrainGeometry } from './TerrainGeometry';

export class RiverSystem {
  private static instance: RiverSystem;

  private noise: SimplexNoise;
  private biomeManager: BiomeManager;

  // Configuration
  private readonly PATH_SCALE = 0.002; // 500 units wavelength
  private readonly PATH_AMPLITUDE = 100;

  private readonly WIDTH_SCALE = 0.002; // Frequency of width changes
  private readonly BANK_NOISE_SCALE = 0.002; // Frequency of bank jaggedness

  private readonly MIN_WIDTH = 15; // Was 30
  private readonly MAX_WIDTH = 75; // Was 150

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
  public getRiverCenter(z: number): number {
    return this.noise.noise2D(0, z * this.PATH_SCALE) * this.PATH_AMPLITUDE;
  }

  /**
   * Returns the derivative (slope) of the river center at z.
   * Useful for determining the tangent/normal vector of the bank.
   */
  public getRiverDerivative(z: number): number {
    const epsilon = 1.0;
    const x1 = this.getRiverCenter(z - epsilon);
    const x2 = this.getRiverCenter(z + epsilon);
    return (x2 - x1) / (2 * epsilon); // dx/dz
  }

  /**
   * Returns the width of the river at a given Z position.
   */
  public getRiverWidth(z: number): number {
    // 1. Biome Noise: Determines if we are in a wide or narrow section
    // Normalized to 0..1
    const biomeNoise = (this.noise.noise2D(100, z * this.WIDTH_SCALE) + 1) / 2;

    // Non-linear mapping to bias towards wider areas occasionally but mostly average
    // biome^2 pushes values lower (narrower), biome^0.5 pushes higher (wider)
    // Let's keep it somewhat linear but clamped

    // Interpolate between Min and Max based on biome
    let baseWidth = this.lerp(this.MIN_WIDTH, this.MAX_WIDTH, biomeNoise);

    // 2. Local Variation: Removed for smoother banks as per user request
    // const localNoise = this.noise.noise2D(200, z * this.BANK_NOISE_SCALE) * 10;

    return Math.max(15, baseWidth);
  }

  /**
   * Returns the X coordinates for the left and right banks.
   */
  public getBankPositions(z: number): { left: number, right: number } {
    const center = this.getRiverCenter(z);
    const width = this.getRiverWidth(z);
    const halfWidth = width / 2;

    // Optional: Add independent noise to banks for asymmetry
    // We can perturb the center slightly based on width to make one bank wider than the other
    const asymmetry = this.noise.noise2D(300, z * this.WIDTH_SCALE) * (width * 0.2);

    return {
      left: center - halfWidth + asymmetry,
      right: center + halfWidth + asymmetry
    };
  }

  public getBiomeManager(): BiomeManager {
    return this.biomeManager;
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
