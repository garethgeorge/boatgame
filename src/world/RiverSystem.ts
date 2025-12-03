import { SimplexNoise } from './SimplexNoise';

export class RiverSystem {
  private static instance: RiverSystem;
  private noise: SimplexNoise;

  // Configuration
  // Configuration
  private readonly PATH_SCALE = 0.002; // 500 units wavelength
  private readonly PATH_AMPLITUDE = 100;

  private readonly WIDTH_SCALE = 0.002; // Frequency of width changes
  private readonly BANK_NOISE_SCALE = 0.002; // Frequency of bank jaggedness

  private readonly MIN_WIDTH = 15; // Was 30
  private readonly MAX_WIDTH = 75; // Was 150

  private readonly COLOR_DESERT = { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 }; // Rich Ochre
  private readonly COLOR_FOREST = { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 }; // Rich Dark Green
  private readonly COLOR_ICE = { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 }; // White/Blue

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

  private getBiomeWeights(z: number): { desert: number, forest: number, ice: number } {
    // Biome Selection (Z-dependent only)
    // Noise -1 to 1
    // Lower frequency for larger biomes (Tripled size: 0.0005 -> 0.000166)
    let n = this.noise.noise2D(100, z * 0.000166);

    // Helper for smoothstep
    const smoothstep = (min: number, max: number, value: number): number => {
      const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return x * x * (3 - 2 * x);
    };

    // Define Ranges:
    // n < -0.2: Mostly Desert
    // -0.2 < n < 0.2: Transition Desert -> Forest
    // 0.2 < n < 0.5: Mostly Forest
    // 0.5 < n < 0.9: Transition Forest -> Ice
    // n > 0.9: Mostly Ice

    // Desert Weight: 1.0 at -1.0, 0.0 at 0.0
    const desert = 1.0 - smoothstep(-0.4, 0.1, n);

    // Ice Weight: 0.0 at 0.4, 1.0 at 0.9
    const ice = smoothstep(0.4, 0.9, n);

    // Forest Weight: Remainder
    // Clamp to ensure no negative values (though logic above should prevent overlap > 1)
    const forest = Math.max(0, 1.0 - desert - ice);

    return { desert, forest, ice };
  }

  public getBiomeColor(z: number): { r: number, g: number, b: number } {
    const weights = this.getBiomeWeights(z);
    return {
      r: this.COLOR_DESERT.r * weights.desert + this.COLOR_FOREST.r * weights.forest + this.COLOR_ICE.r * weights.ice,
      g: this.COLOR_DESERT.g * weights.desert + this.COLOR_FOREST.g * weights.forest + this.COLOR_ICE.g * weights.ice,
      b: this.COLOR_DESERT.b * weights.desert + this.COLOR_FOREST.b * weights.forest + this.COLOR_ICE.b * weights.ice
    };
  }

  public getBiomeType(worldZ: number): 'desert' | 'forest' | 'ice' {
    const weights = this.getBiomeWeights(worldZ);

    // Force Ice biome if there is any significant ice weight
    if (weights.ice > 0.1)
      return 'ice';

    if (weights.desert > 0.5)
      return 'desert';

    return 'forest';
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
