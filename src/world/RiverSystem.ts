import { smootherstep, smoothstep } from 'three/src/math/MathUtils';
import { SimplexNoise } from './SimplexNoise';
import * as THREE from 'three';

export class RiverSystem {
  private static instance: RiverSystem;
  private noise: SimplexNoise;
  private biomeArray: Array<'desert' | 'forest' | 'ice'>;
  private readonly BIOME_ARRAY_SIZE = 100;
  private readonly BIOME_SCALE = 0.001; // Multiplier for converting worldZ to biome array index
  private readonly BIOME_TRANSITION_WIDTH = 0.05; // Width of biome transition zone

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

    // Create array of randomly assigned biomes
    this.biomeArray = [];
    const biomeTypes: Array<'desert' | 'forest' | 'ice'> = ['desert', 'forest', 'ice'];
    const randomBiome = Math.floor(Math.random() * biomeTypes.length);
    this.biomeArray.push(biomeTypes[randomBiome]);
    while (this.biomeArray.length < this.BIOME_ARRAY_SIZE) {
      const previousBiome = this.biomeArray[this.biomeArray.length - 1];
      const randomBiome = Math.floor(Math.random() * biomeTypes.length);
      if (biomeTypes[randomBiome] != previousBiome) {
        this.biomeArray.push(biomeTypes[randomBiome]);
      }
    }
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

  public getBiomeType(worldZ: number): 'desert' | 'forest' | 'ice' {
    // Convert z to an index in the biome array
    // Use modulo to wrap around for both positive and negative values
    const index = ((Math.floor(worldZ * this.BIOME_SCALE) % this.BIOME_ARRAY_SIZE) + this.BIOME_ARRAY_SIZE) % this.BIOME_ARRAY_SIZE;
    return this.biomeArray[index];
  }

  public getBiomeMixture(worldZ: number): {
    biome1: 'desert' | 'forest' | 'ice',
    biome2: 'desert' | 'forest' | 'ice',
    weight1: number,
    weight2: number
  } {
    const transitionWidth = this.BIOME_TRANSITION_WIDTH;

    // Convert z to a continuous index value
    const continuousIndex = worldZ * this.BIOME_SCALE;

    // Get the current biome index (floor of continuous index)
    const currentIndex = Math.floor(continuousIndex);

    // Calculate the fractional part (0 to 1) representing position within the current biome
    const fraction = continuousIndex - currentIndex;

    let index1 = currentIndex;
    let index2 = currentIndex;
    let weight1 = 1.0;
    let weight2 = 0.0;

    // Check if we're in a transition zone
    if (fraction < transitionWidth) {
      // Transitioning FROM previous biome TO current biome
      index1 = currentIndex;
      index2 = currentIndex - 1;
      // As fraction goes from 0 to transitionWidth, weight1 goes from 0.5 to 1.0
      weight1 = this.lerp(0.5, 1.0, fraction / transitionWidth);
      weight2 = 1.0 - weight1;
    } else if (fraction > 1.0 - transitionWidth) {
      // Transitioning FROM current biome TO next biome
      index1 = currentIndex;
      index2 = currentIndex + 1;
      // As fraction goes from (1-transitionWidth) to 1.0, weight1 goes from 1.0 to 0.5
      const transitionFraction = (fraction - (1.0 - transitionWidth)) / transitionWidth;
      weight1 = this.lerp(1.0, 0.5, transitionFraction);
      weight2 = 1.0 - weight1;
    }

    // Wrap indices to array bounds (handle both positive and negative)
    const wrappedIndex1 = ((index1 % this.BIOME_ARRAY_SIZE) + this.BIOME_ARRAY_SIZE) % this.BIOME_ARRAY_SIZE;
    const wrappedIndex2 = ((index2 % this.BIOME_ARRAY_SIZE) + this.BIOME_ARRAY_SIZE) % this.BIOME_ARRAY_SIZE;

    const biome1 = this.biomeArray[wrappedIndex1];
    const biome2 = this.biomeArray[wrappedIndex2];

    return { biome1, biome2, weight1, weight2 };
  }

  public getBiomeFogDensity(z: number): number {
    const biomeType = this.getBiomeType(z);
    if (biomeType === 'ice') {
      const fraction = z - Math.floor(z * this.BIOME_SCALE);
      return fraction < this.BIOME_TRANSITION_WIDTH ?
        smoothstep(fraction / this.BIOME_TRANSITION_WIDTH, 0.0, 0.9) :
        fraction < 1.0 - this.BIOME_TRANSITION_WIDTH ? 0.9 :
          smoothstep((1.0 - fraction) / this.BIOME_TRANSITION_WIDTH, 0.0, 0.9);
    }
    return 0.0;
  }

  public getBiomeGroundColor(z: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(z);

    // Get colors for both biomes
    const color1 = this.getBiomeColor(mixture.biome1);
    const color2 = this.getBiomeColor(mixture.biome2);

    // Blend the colors based on weights
    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  private getBiomeColor(biome: 'desert' | 'forest' | 'ice'): { r: number, g: number, b: number } {
    switch (biome) {
      case 'desert': return this.COLOR_DESERT;
      case 'forest': return this.COLOR_FOREST;
      case 'ice': return this.COLOR_ICE;
    }
  }

  public getBiomeSkyGradient(z: number, dayness: number): { top: THREE.Color, bottom: THREE.Color } {
    const mixture = this.getBiomeMixture(z);

    // Get sky gradient for each biome
    const sky1 = this.getBiomeSkyColors(mixture.biome1, dayness);
    const sky2 = this.getBiomeSkyColors(mixture.biome2, dayness);

    // Blend the two sky gradients based on mixture weights
    const top = sky1.top.clone().multiplyScalar(mixture.weight1).add(sky2.top.clone().multiplyScalar(mixture.weight2));
    const bottom = sky1.bottom.clone().multiplyScalar(mixture.weight1).add(sky2.bottom.clone().multiplyScalar(mixture.weight2));

    return { top, bottom };
  }

  private getBiomeSkyColors(biome: 'desert' | 'forest' | 'ice', dayness: number): { top: THREE.Color, bottom: THREE.Color } {
    // Sky Color Interpolation
    // Pastel Sunset Vibe
    // Day (Sunset): Lavender to Peach
    // Night: Deep Slate Blue to Dark Purple

    const dayTop = new THREE.Color(0xA69AC2); // Pastel Lavender
    const dayBot = new THREE.Color(0xFFCBA4); // Pastel Peach
    const nightTop = new THREE.Color(0x1A1A3A); // Dark Slate Blue
    const nightBot = new THREE.Color(0x2D2D44); // Muted Dark Purple
    const sunsetTop = new THREE.Color(0x967BB6); // Muted Purple
    const sunsetBot = new THREE.Color(0xFF9966); // Soft Orange

    let currentTop: THREE.Color;
    let currentBot: THREE.Color;

    // Transition threshold (approx 20 degrees / 200 radius = 0.1)
    const transitionThreshold = 0.1;

    if (dayness > 0) {
      // Day
      if (dayness < transitionThreshold) {
        // Sunrise / Sunset transition
        const t = dayness / transitionThreshold;
        currentTop = sunsetTop.clone().lerp(dayTop, t);
        currentBot = sunsetBot.clone().lerp(dayBot, t);
      } else {
        currentTop = dayTop.clone();
        currentBot = dayBot.clone();
      }
    } else {
      // Night
      if (dayness > -transitionThreshold) {
        // Twilight
        const t = -dayness / transitionThreshold;
        currentTop = sunsetTop.clone().lerp(nightTop, t);
        currentBot = sunsetBot.clone().lerp(nightBot, t);
      } else {
        currentTop = nightTop.clone();
        currentBot = nightBot.clone();
      }
    }

    // Apply Biome Modifier to Sky Colors
    // Forest: Cooler, Crisper Blue
    // Desert: Warmer, Duster (Default)
    // Ice: Cooler, whiter

    if (dayness > 0) {
      if (biome === 'forest') {
        const forestTopMod = new THREE.Color(0x4488ff); // Crisp Blue
        const forestBotMod = new THREE.Color(0xcceeff); // White/Blue Horizon
        currentTop.lerp(forestTopMod, 0.6);
        currentBot.lerp(forestBotMod, 0.6);
      } else if (biome === 'ice') {
        const iceTopMod = new THREE.Color(0xddeeff); // Pale Ice Blue
        const iceBotMod = new THREE.Color(0xffffff); // White
        currentTop.lerp(iceTopMod, 0.8);
        currentBot.lerp(iceBotMod, 0.8);
      }
      // Desert uses default colors (no modification)
    }

    return { top: currentTop, bottom: currentBot };
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
