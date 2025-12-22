import { smoothstep } from 'three/src/math/MathUtils';
import * as THREE from 'three';
import { BiomeFeatures } from './biomes/BiomeFeatures';
import { DesertBiomeFeatures } from './biomes/DesertBiomeFeatures';
import { ForestBiomeFeatures } from './biomes/ForestBiomeFeatures';
import { IceBiomeFeatures } from './biomes/IceBiomeFeatures';
import { SwampBiomeFeatures } from './biomes/SwampBiomeFeatures';
import { JurassicBiomeFeatures } from './biomes/JurassicBiomeFeatures';
import { TestBiomeFeatures } from './biomes/TestBiomeFeatures';
import { BiomeType } from './biomes/BiomeType';

export class BiomeManager {
  public static DEBUG_BIOME = true;

  public readonly BIOME_LENGTH = 1000;
  private biomeArray: Array<BiomeType>;
  private readonly BIOME_ARRAY_SIZE = 100;
  private readonly BIOME_SCALE = 1.0 / this.BIOME_LENGTH; // Multiplier for converting worldZ to biome array index
  private readonly BIOME_TRANSITION_WIDTH = 0.05; // Width of biome transition zone
  private features: Map<BiomeType, BiomeFeatures> = new Map();


  constructor() {
    this.biomeArray = [];
    const biomeTypes: Array<BiomeType> = ['desert', 'forest', 'ice', 'swamp', 'jurassic'];

    // Initialize features
    this.features.set('desert', new DesertBiomeFeatures());
    this.features.set('forest', new ForestBiomeFeatures());
    this.features.set('ice', new IceBiomeFeatures());
    this.features.set('swamp', new SwampBiomeFeatures());
    this.features.set('jurassic', new JurassicBiomeFeatures());
    this.features.set('test', new TestBiomeFeatures());

    if (BiomeManager.DEBUG_BIOME) {
      this.biomeArray = new Array(this.BIOME_ARRAY_SIZE).fill('test');
      return;
    }

    while (this.biomeArray.length < this.BIOME_ARRAY_SIZE) {
      // Create a shuffled list of biome types
      const shuffled = [...biomeTypes];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Ensure the first biome in the list is not the same as the last one currently in the array
      if (this.biomeArray.length > 0) {
        const lastBiome = this.biomeArray[this.biomeArray.length - 1];
        if (shuffled[0] === lastBiome) {
          // Swap the first element with the last element of the shuffled array
          // Since all elements in biomeTypes are unique, the last element is guaranteed to be different
          const temp = shuffled[0];
          shuffled[0] = shuffled[shuffled.length - 1];
          shuffled[shuffled.length - 1] = temp;
        }
      }

      // Append the list to the array
      this.biomeArray.push(...shuffled);
    }
  }

  public getBiomeType(worldZ: number): BiomeType {
    // Convert z to an index in the biome array
    // Use modulo to wrap around for both positive and negative values
    const index = ((Math.floor(worldZ * this.BIOME_SCALE) % this.BIOME_ARRAY_SIZE) + this.BIOME_ARRAY_SIZE) % this.BIOME_ARRAY_SIZE;
    return this.biomeArray[index];
  }

  public getFeatureSegments(zStart: number, zEnd: number): Array<{ biome: BiomeType, zStart: number, zEnd: number, biomeZStart: number, biomeZEnd: number }> {
    const segments: Array<{ biome: BiomeType, zStart: number, zEnd: number, biomeZStart: number, biomeZEnd: number }> = [];
    let currentZ = zStart;

    while (currentZ < zEnd) {
      const biomeType = this.getBiomeType(currentZ);
      // Find the next boundary after currentZ
      // A boundary exists every BIOME_LENGTH meters.
      const boundaryIndex = Math.floor(currentZ / this.BIOME_LENGTH);
      const minZ = boundaryIndex * this.BIOME_LENGTH;
      const maxZ = (boundaryIndex + 1) * this.BIOME_LENGTH;

      const biomeZStart = minZ >= 0 ? minZ : maxZ;
      const biomeZEnd = minZ >= 0 ? maxZ : minZ;

      const segmentEnd = Math.min(zEnd, maxZ);
      segments.push({ biome: biomeType, zStart: currentZ, zEnd: segmentEnd, biomeZStart, biomeZEnd });
      currentZ = segmentEnd;
    }

    return segments;
  }

  public getFeatures(biome: BiomeType): BiomeFeatures {
    return this.features.get(biome)!;
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
    const d1 = this.getFeatures(mixture.biome1).getFogDensity();
    const d2 = this.getFeatures(mixture.biome2).getFogDensity();
    return d1 * mixture.weight1 + d2 * mixture.weight2;
  }

  public getBiomeFogRange(worldZ: number): { near: number, far: number } {
    const mixture = this.getBiomeMixture(worldZ);
    const range1 = this.getFeatures(mixture.biome1).getFogRange();
    const range2 = this.getFeatures(mixture.biome2).getFogRange();

    return {
      near: this.lerp(range1.near, range2.near, mixture.weight2), // weight2 is t from 1 to 2
      far: this.lerp(range1.far, range2.far, mixture.weight2)
    };
  }

  public getBiomeGroundColor(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

    const color1 = this.getFeatures(mixture.biome1).getGroundColor();
    const color2 = this.getFeatures(mixture.biome2).getGroundColor();

    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  public getBiomeScreenTint(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

    const color1 = this.getFeatures(mixture.biome1).getScreenTint();
    const color2 = this.getFeatures(mixture.biome2).getScreenTint();

    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  public getBiomeSkyGradient(worldZ: number, dayness: number): { top: THREE.Color, bottom: THREE.Color } {
    const mixture = this.getBiomeMixture(worldZ);

    // Get sky gradient for each biome
    const sky1 = this.getFeatures(mixture.biome1).getSkyColors(dayness);
    const sky2 = this.getFeatures(mixture.biome2).getSkyColors(dayness);

    // Blend the two sky gradients based on mixture weights
    const top = sky1.top.clone().multiplyScalar(mixture.weight1).add(sky2.top.clone().multiplyScalar(mixture.weight2));
    const bottom = sky1.bottom.clone().multiplyScalar(mixture.weight1).add(sky2.bottom.clone().multiplyScalar(mixture.weight2));

    return { top, bottom };
  }

  public getAmplitudeMultiplier(wz: number): number {
    const mixture = this.getBiomeMixture(wz);
    const amplitude1 = this.getFeatures(mixture.biome1).getAmplitudeMultiplier();
    const amplitude2 = this.getFeatures(mixture.biome2).getAmplitudeMultiplier();

    const amplitudeMultiplier = amplitude1 * mixture.weight1 + amplitude2 * mixture.weight2;
    return amplitudeMultiplier;
  }

  public getRiverWidthMultiplier(worldZ: number): number {
    // Apply Swamp Modifier: Widen river significantly
    const mixture = this.getBiomeMixture(worldZ);
    const width1 = this.getFeatures(mixture.biome1).getRiverWidthMultiplier();
    const width2 = this.getFeatures(mixture.biome2).getRiverWidthMultiplier();

    const widthMultiplier = width1 * mixture.weight1 + width2 * mixture.weight2;
    return widthMultiplier;
  }

  public getRiverMaterialSwampFactor(worldZ: number): number {
    const mixture = this.getBiomeMixture(worldZ);
    let swampFactor = 0.0;
    if (mixture.biome1 === 'swamp') swampFactor += mixture.weight1;
    if (mixture.biome2 === 'swamp') swampFactor += mixture.weight2;
    return swampFactor;
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
