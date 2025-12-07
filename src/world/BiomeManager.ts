import { smoothstep } from 'three/src/math/MathUtils';
import * as THREE from 'three';

export type BiomeType = 'desert' | 'forest' | 'ice' | 'swamp';

export class BiomeManager {
  private biomeArray: Array<BiomeType>;
  private readonly BIOME_ARRAY_SIZE = 100;
  private readonly BIOME_SCALE = 0.001; // Multiplier for converting worldZ to biome array index
  private readonly BIOME_TRANSITION_WIDTH = 0.05; // Width of biome transition zone

  private readonly COLOR_DESERT = { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 }; // Rich Ochre
  private readonly COLOR_FOREST = { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 }; // Rich Dark Green
  private readonly COLOR_ICE = { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 }; // White/Blue
  private readonly COLOR_SWAMP = { r: 0x5D / 255, g: 0x53 / 255, b: 0x46 / 255 }; // Desaturated Earth Tone
  private readonly COLOR_SWAMP_TINT = { r: 0xB0 / 255, g: 0xA0 / 255, b: 0xD0 / 255 }; // Lavender Tint

  constructor() {
    // Create array of randomly assigned biomes
    this.biomeArray = [];
    const biomeTypes: Array<BiomeType> = ['desert', 'forest', 'ice', 'swamp'];
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

  public getBiomeType(worldZ: number): BiomeType {
    // Convert z to an index in the biome array
    // Use modulo to wrap around for both positive and negative values
    const index = ((Math.floor(worldZ * this.BIOME_SCALE) % this.BIOME_ARRAY_SIZE) + this.BIOME_ARRAY_SIZE) % this.BIOME_ARRAY_SIZE;
    return this.biomeArray[index];
  }

  public getBiomeMixture(worldZ: number): {
    biome1: BiomeType,
    biome2: BiomeType,
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

  public getBiomeFogDensity(worldZ: number): number {
    const mixture = this.getBiomeMixture(worldZ);

    const getDensity = (biome: BiomeType) => {
      if (biome === 'ice') return 0.9;
      if (biome === 'swamp') return 0.6;
      return 0.0;
    };

    return getDensity(mixture.biome1) * mixture.weight1 + getDensity(mixture.biome2) * mixture.weight2;
  }

  public getBiomeGroundColor(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

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

  public getBiomeScreenTint(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

    const getTint = (biome: BiomeType) => {
      if (biome === 'swamp') return this.COLOR_SWAMP_TINT;
      return this.getBiomeColor(biome); // Default to ground color for other biomes
    };

    const color1 = getTint(mixture.biome1);
    const color2 = getTint(mixture.biome2);

    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  private getBiomeColor(biome: BiomeType): { r: number, g: number, b: number } {
    switch (biome) {
      case 'desert': return this.COLOR_DESERT;
      case 'forest': return this.COLOR_FOREST;
      case 'ice': return this.COLOR_ICE;
      case 'swamp': return this.COLOR_SWAMP;
    }
  }

  public getBiomeSkyGradient(worldZ: number, dayness: number): { top: THREE.Color, bottom: THREE.Color } {
    const mixture = this.getBiomeMixture(worldZ);

    // Get sky gradient for each biome
    const sky1 = this.getBiomeSkyColors(mixture.biome1, dayness);
    const sky2 = this.getBiomeSkyColors(mixture.biome2, dayness);

    // Blend the two sky gradients based on mixture weights
    const top = sky1.top.clone().multiplyScalar(mixture.weight1).add(sky2.top.clone().multiplyScalar(mixture.weight2));
    const bottom = sky1.bottom.clone().multiplyScalar(mixture.weight1).add(sky2.bottom.clone().multiplyScalar(mixture.weight2));

    return { top, bottom };
  }

  private getBiomeSkyColors(biome: BiomeType, dayness: number): { top: THREE.Color, bottom: THREE.Color } {
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
    // Swamp: Lavender/Purple tint

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
      } else if (biome === 'swamp') {
        const swampTopMod = new THREE.Color(0x8877aa); // Muted Purple
        const swampBotMod = new THREE.Color(0xaa99cc); // Lavender
        currentTop.lerp(swampTopMod, 0.7);
        currentBot.lerp(swampBotMod, 0.7);
      }
      // Desert uses default colors (no modification)
    }

    return { top: currentTop, bottom: currentBot };
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
