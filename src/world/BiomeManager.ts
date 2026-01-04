import { smoothstep } from 'three/src/math/MathUtils';
import * as THREE from 'three';
import { BiomeFeatures } from './biomes/BiomeFeatures';
import { DesertBiomeFeatures } from './biomes/DesertBiomeFeatures';
import { ForestBiomeFeatures } from './biomes/ForestBiomeFeatures';
import { IceBiomeFeatures } from './biomes/IceBiomeFeatures';
import { SwampBiomeFeatures } from './biomes/SwampBiomeFeatures';
import { JurassicBiomeFeatures } from './biomes/JurassicBiomeFeatures';
import { TestBiomeFeatures } from './biomes/TestBiomeFeatures';
import { FracturedIceBiomeFeatures } from './biomes/FracturedIceBiomeFeatures';
import { BiomeType } from './biomes/BiomeType';

interface BiomeInstance {
  type: BiomeType;
  length: number;
  zStart: number;
  zEnd: number;
}

export class BiomeManager {
  public static DEBUG_BIOME = false;

  private biomeInstances: BiomeInstance[] = [];
  private totalSequenceLength = 0;
  private readonly BIOME_ARRAY_SIZE = 100;
  private readonly BIOME_TRANSITION_WIDTH = 50; // Transition width in units, not fraction
  private features: Map<BiomeType, BiomeFeatures> = new Map();
  private layoutCache: Map<number, any> = new Map();
  private readonly MAX_LAYOUT_CACHE_SIZE = 20;

  constructor() {
    const biomeTypes: Array<BiomeType> = ['desert', 'forest', 'ice', 'swamp', 'jurassic', 'fractured_ice'];

    // Initialize features
    this.features.set('desert', new DesertBiomeFeatures());
    this.features.set('forest', new ForestBiomeFeatures());
    this.features.set('ice', new IceBiomeFeatures());
    this.features.set('swamp', new SwampBiomeFeatures());
    this.features.set('jurassic', new JurassicBiomeFeatures());
    this.features.set('test', new TestBiomeFeatures());
    this.features.set('fractured_ice', new FracturedIceBiomeFeatures());

    let biomeSequence: BiomeType[] = [];

    if (BiomeManager.DEBUG_BIOME) {
      biomeSequence = new Array(this.BIOME_ARRAY_SIZE).fill('test');
    } else {
      while (biomeSequence.length < this.BIOME_ARRAY_SIZE) {
        // Create a shuffled list of biome types
        const shuffled = [...biomeTypes];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Ensure the first biome in the list is not the same as the last one currently in the array
        if (biomeSequence.length > 0) {
          const lastBiome = biomeSequence[biomeSequence.length - 1];
          if (shuffled[0] === lastBiome) {
            const temp = shuffled[0];
            shuffled[0] = shuffled[shuffled.length - 1];
            shuffled[shuffled.length - 1] = temp;
          }
        }

        // Append the list to the array
        biomeSequence.push(...shuffled);
      }
    }

    // Convert types to instances with specific lengths and boundaries
    let currentZ = 0;
    for (const type of biomeSequence) {
      const length = this.getFeatures(type).getBiomeLength();
      this.biomeInstances.push({
        type,
        length,
        zStart: currentZ,
        zEnd: currentZ + length
      });
      currentZ += length;
    }
    this.totalSequenceLength = currentZ;
  }

  /**
   * Finds the biome instance containing the given worldZ (modulo totalSequenceLength)
   */
  private getBiomeInstanceAt(worldZ: number): BiomeInstance {
    const index = this.getBiomeInstanceIndexAt(worldZ);
    return this.biomeInstances[index];
  }

  /**
   * Finds the index of the biome instance containing the given worldZ
   */
  private getBiomeInstanceIndexAt(worldZ: number): number {
    const normalizedZ = ((worldZ % this.totalSequenceLength) + this.totalSequenceLength) % this.totalSequenceLength;

    let low = 0;
    let high = this.biomeInstances.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const instance = this.biomeInstances[mid];

      if (normalizedZ >= instance.zStart && normalizedZ < instance.zEnd) {
        return mid;
      } else if (normalizedZ < instance.zStart) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return 0;
  }

  public getBiomeType(worldZ: number): BiomeType {
    return this.getBiomeInstanceAt(worldZ).type;
  }

  public getBiomeBoundaries(worldZ: number): { zStart: number, zEnd: number } {
    const instance = this.getBiomeInstanceAt(worldZ);
    const numSequences = Math.floor(worldZ / this.totalSequenceLength);
    const sequenceOffset = numSequences * this.totalSequenceLength;
    return {
      zStart: sequenceOffset + instance.zStart,
      zEnd: sequenceOffset + instance.zEnd
    };
  }

  public getFeatureSegments(zStart: number, zEnd: number): Array<{
    biome: BiomeType,
    zStart: number, zEnd: number,
    biomeZStart: number, biomeZEnd: number,
    biomeIndex: number
  }> {

    const segments: Array<{ biome: BiomeType, zStart: number, zEnd: number, biomeZStart: number, biomeZEnd: number, biomeIndex: number }> = [];
    let currentZ = zStart;

    while (currentZ < zEnd) {
      const index = this.getBiomeInstanceIndexAt(currentZ);
      const instance = this.biomeInstances[index];

      // We need to provide the "real" biomeZStart and biomeZEnd in world coordinates, 
      // not normalized sequence coordinates.
      // This is tricky because worldZ can be much larger than totalSequenceLength.
      const numSequences = Math.floor(currentZ / this.totalSequenceLength);
      const sequenceOffset = numSequences * this.totalSequenceLength;

      const biomeZStart = sequenceOffset + instance.zStart;
      const biomeZEnd = sequenceOffset + instance.zEnd;

      const biomeIndex = numSequences * this.biomeInstances.length + index;

      const segmentEnd = Math.min(zEnd, biomeZEnd);
      segments.push({
        biome: instance.type,
        zStart: currentZ,
        zEnd: segmentEnd,
        biomeZStart,
        biomeZEnd,
        biomeIndex
      });
      currentZ = segmentEnd;
    }

    return segments;
  }

  public getFeatures(biome: BiomeType): BiomeFeatures {
    return this.features.get(biome)!;
  }

  public getLayoutForBiome(biomeIndex: number, zStart: number, zEnd: number): any {
    if (this.layoutCache.has(biomeIndex)) {
      return this.layoutCache.get(biomeIndex);
    }

    const localIndex = ((biomeIndex % this.biomeInstances.length) + this.biomeInstances.length) % this.biomeInstances.length;
    const instance = this.biomeInstances[localIndex];
    const layout = this.getFeatures(instance.type).createLayout(zStart, zEnd);

    // Basic cache management
    if (this.layoutCache.size >= this.MAX_LAYOUT_CACHE_SIZE) {
      const firstKey = this.layoutCache.keys().next().value;
      if (firstKey !== undefined) this.layoutCache.delete(firstKey);
    }
    this.layoutCache.set(biomeIndex, layout);

    return layout;
  }

  public getBiomeMixture(worldZ: number): {
    biome1: BiomeType,
    biome2: BiomeType,
    weight1: number,
    weight2: number
  } {
    const transitionWidth = this.BIOME_TRANSITION_WIDTH;
    const normalizedZ = ((worldZ % this.totalSequenceLength) + this.totalSequenceLength) % this.totalSequenceLength;

    const index = this.getBiomeInstanceIndexAt(worldZ);
    const instance = this.biomeInstances[index];

    let biome1 = instance.type;
    let biome2 = instance.type;
    let weight1 = 1.0;
    let weight2 = 0.0;

    const distFromStart = normalizedZ - instance.zStart;
    const distFromEnd = instance.zEnd - normalizedZ;

    if (distFromStart < transitionWidth / 2) {
      // Transition from previous biome
      const prevIndex = (index - 1 + this.biomeInstances.length) % this.biomeInstances.length;
      biome1 = instance.type;
      biome2 = this.biomeInstances[prevIndex].type;

      // As distFromStart goes from 0 to transitionWidth/2, weight1 goes from 0.5 to 1.0
      const t = distFromStart / (transitionWidth / 2);
      weight1 = this.lerp(0.5, 1.0, t);
      weight2 = 1.0 - weight1;
    } else if (distFromEnd < transitionWidth / 2) {
      // Transition to next biome
      const nextIndex = (index + 1) % this.biomeInstances.length;
      biome1 = instance.type;
      biome2 = this.biomeInstances[nextIndex].type;

      // As distFromEnd goes from transitionWidth/2 to 0, weight1 goes from 1.0 to 0.5
      const t = (transitionWidth / 2 - distFromEnd) / (transitionWidth / 2);
      weight1 = this.lerp(1.0, 0.5, t);
      weight2 = 1.0 - weight1;
    }

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
