import { SimplexNoise } from './SimplexNoise';

export class RiverSystem {
  private static instance: RiverSystem;
  private noise: SimplexNoise;

  // Configuration
  // Configuration
  private readonly PATH_SCALE = 0.002; // 500 units wavelength
  private readonly PATH_AMPLITUDE = 100;

  private readonly WIDTH_SCALE = 0.002; // 500 units wavelength (faster variation)
  private readonly BANK_NOISE_SCALE = 0.002; // 500 units wavelength (smoother banks)

  private readonly MIN_WIDTH = 30;
  private readonly MAX_WIDTH = 150;

  private constructor() {
    this.noise = new SimplexNoise(100);
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

    // 2. Local Variation: Adds "roughness" to the width
    const localNoise = this.noise.noise2D(200, z * this.BANK_NOISE_SCALE) * 10;

    return Math.max(15, baseWidth + localNoise);
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

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
