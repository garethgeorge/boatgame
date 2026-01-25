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
import { HappyBiomeFeatures } from './biomes/HappyBiomeFeatures';
import { BiomeType } from './biomes/BiomeType';

interface BiomeInstance {
  type: BiomeType;
  length: number;
  zMin: number;
  zMax: number;
}

const BIOME_LENGTHS: Record<BiomeType, number> = {
  'desert': 2000,
  'forest': 2000,
  'ice': 1000,
  'swamp': 1600,
  'jurassic': 2000,
  'test': 1000,
  'fractured_ice': 1500, // Conservatively similar to swamp/forest
  'happy': 1500
};

const BIOME_CONSTRUCTORS: Record<BiomeType, any> = {
  'desert': DesertBiomeFeatures,
  'forest': ForestBiomeFeatures,
  'ice': IceBiomeFeatures,
  'swamp': SwampBiomeFeatures,
  'jurassic': JurassicBiomeFeatures,
  'test': TestBiomeFeatures,
  'fractured_ice': FracturedIceBiomeFeatures,
  'happy': HappyBiomeFeatures
};

export class BiomeManager {
  public static DEBUG_BIOME = false;

  private biomeInstances: BiomeInstance[] = [];
  private totalSequenceLength = 0;
  private readonly BIOME_ARRAY_SIZE = 100;
  private readonly BIOME_TRANSITION_WIDTH = 50; // Transition width in units, not fraction
  private featuresCache: Map<number, BiomeFeatures> = new Map();
  private readonly MAX_FEATURES_CACHE_SIZE = 20;

  constructor() {
    let biomeSequence: BiomeType[] = [];
    const otherBiomeTypes: Array<BiomeType> = ['desert', 'forest', 'ice', 'swamp', 'jurassic'];
    const happyBiome: BiomeType = 'happy';

    if (BiomeManager.DEBUG_BIOME) {
      biomeSequence = new Array(this.BIOME_ARRAY_SIZE).fill('test');
    } else {
      biomeSequence.push(happyBiome);
      while (biomeSequence.length < this.BIOME_ARRAY_SIZE) {
        // Create a shuffled list of other biome types
        const shuffled = [...otherBiomeTypes];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        for (const type of shuffled) {
          biomeSequence.push(type);
          biomeSequence.push(happyBiome);
          if (biomeSequence.length >= this.BIOME_ARRAY_SIZE) break;
        }
      }
    }

    // Convert types to instances with specific lengths and boundaries
    let currentZ = 0;
    for (const type of biomeSequence) {
      const length = BIOME_LENGTHS[type];
      this.biomeInstances.push({
        type,
        length,
        zMin: currentZ,
        zMax: currentZ + length
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

      if (normalizedZ >= instance.zMin && normalizedZ < instance.zMax) {
        return mid;
      } else if (normalizedZ < instance.zMin) {
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

  public getBiomeBoundaries(worldZ: number): { zMin: number, zMax: number } {
    const instance = this.getBiomeInstanceAt(worldZ);
    const numSequences = Math.floor(worldZ / this.totalSequenceLength);
    const sequenceOffset = numSequences * this.totalSequenceLength;
    return {
      zMin: sequenceOffset + instance.zMin,
      zMax: sequenceOffset + instance.zMax
    };
  }

  public getFeatureSegments(zMin: number, zMax: number): Array<{
    biome: BiomeType,
    zMin: number, zMax: number,
    biomeZMin: number, biomeZMax: number,
    biomeIndex: number
  }> {

    const segments: Array<{ biome: BiomeType, zMin: number, zMax: number, biomeZMin: number, biomeZMax: number, biomeIndex: number }> = [];
    let currentZ = zMin;

    while (currentZ < zMax) {
      const index = this.getBiomeInstanceIndexAt(currentZ);
      const instance = this.biomeInstances[index];

      // We need to provide the "real" biomeZMin and biomeZMax in world coordinates, 
      // not normalized sequence coordinates.
      // This is tricky because worldZ can be much larger than totalSequenceLength.
      const numSequences = Math.floor(currentZ / this.totalSequenceLength);
      const sequenceOffset = numSequences * this.totalSequenceLength;

      const biomeZMin = sequenceOffset + instance.zMin;
      const biomeZMax = sequenceOffset + instance.zMax;

      const biomeIndex = numSequences * this.biomeInstances.length + index;

      const segmentEnd = Math.min(zMax, biomeZMax);
      segments.push({
        biome: instance.type,
        zMin: currentZ,
        zMax: segmentEnd,
        biomeZMin,
        biomeZMax,
        biomeIndex
      });
      currentZ = segmentEnd;
    }

    return segments;
  }

  public getFeatures(biomeIndex: number): BiomeFeatures {
    if (this.featuresCache.has(biomeIndex)) {
      const features = this.featuresCache.get(biomeIndex)!;
      // Refresh LRU
      this.featuresCache.delete(biomeIndex);
      this.featuresCache.set(biomeIndex, features);
      return features;
    }

    const localIndex = ((biomeIndex % this.biomeInstances.length) + this.biomeInstances.length) % this.biomeInstances.length;
    const instance = this.biomeInstances[localIndex];

    const numSequences = Math.floor(biomeIndex / this.biomeInstances.length);
    const sequenceOffset = numSequences * this.totalSequenceLength;

    const zMin = sequenceOffset + instance.zMin;
    const zMax = sequenceOffset + instance.zMax;

    // Use a method for instantiation to handle potential undefined classes during load
    const Constructor = BIOME_CONSTRUCTORS[instance.type];
    if (!Constructor) {
      throw new Error(`Biome constructor not found for type: ${instance.type}`);
    }
    const features = new Constructor(zMin, zMax);

    // Basic LRU management
    if (this.featuresCache.size >= this.MAX_FEATURES_CACHE_SIZE) {
      const firstKey = this.featuresCache.keys().next().value;
      if (firstKey !== undefined) this.featuresCache.delete(firstKey);
    }
    this.featuresCache.set(biomeIndex, features);

    return features;
  }

  public getBiomeMixture(worldZ: number): {
    index1: number,
    index2: number,
    weight1: number,
    weight2: number
  } {
    const transitionWidth = this.BIOME_TRANSITION_WIDTH;
    const normalizedZ = ((worldZ % this.totalSequenceLength) + this.totalSequenceLength) % this.totalSequenceLength;

    const index = this.getBiomeInstanceIndexAt(worldZ);
    const instance = this.biomeInstances[index];

    const numSequences = Math.floor(worldZ / this.totalSequenceLength);
    const biomeIndex = numSequences * this.biomeInstances.length + index;

    let index1 = biomeIndex;
    let index2 = biomeIndex;
    let weight1 = 1.0;
    let weight2 = 0.0;

    const distFromStart = normalizedZ - instance.zMin;
    const distFromEnd = instance.zMax - normalizedZ;

    if (distFromStart < transitionWidth / 2) {
      // Transition from previous biome
      const prevIndex = (index - 1 + this.biomeInstances.length) % this.biomeInstances.length;
      const prevNumSequences = index === 0 ? numSequences - 1 : numSequences;
      const prevBiomeIndex = prevNumSequences * this.biomeInstances.length + prevIndex;

      index1 = biomeIndex;
      index2 = prevBiomeIndex;

      const t = distFromStart / (transitionWidth / 2);
      weight1 = this.lerp(0.5, 1.0, t);
      weight2 = 1.0 - weight1;
    } else if (distFromEnd < transitionWidth / 2) {
      // Transition to next biome
      const nextIndex = (index + 1) % this.biomeInstances.length;
      const nextNumSequences = index === this.biomeInstances.length - 1 ? numSequences + 1 : numSequences;
      const nextBiomeIndex = nextNumSequences * this.biomeInstances.length + nextIndex;

      index1 = biomeIndex;
      index2 = nextBiomeIndex;

      const t = (transitionWidth / 2 - distFromEnd) / (transitionWidth / 2);
      weight1 = this.lerp(1.0, 0.5, t);
      weight2 = 1.0 - weight1;
    }

    return { index1, index2, weight1, weight2 };
  }

  public getBiomeFogDensity(worldZ: number): number {
    const mixture = this.getBiomeMixture(worldZ);
    const d1 = this.getFeatures(mixture.index1).getFogDensity();
    const d2 = this.getFeatures(mixture.index2).getFogDensity();
    return d1 * mixture.weight1 + d2 * mixture.weight2;
  }

  public getBiomeFogRange(worldZ: number): { near: number, far: number } {
    const mixture = this.getBiomeMixture(worldZ);
    const range1 = this.getFeatures(mixture.index1).getFogRange();
    const range2 = this.getFeatures(mixture.index2).getFogRange();

    return {
      near: this.lerp(range1.near, range2.near, mixture.weight2), // weight2 is t from 1 to 2
      far: this.lerp(range1.far, range2.far, mixture.weight2)
    };
  }

  public getBiomeGroundColor(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

    const color1 = this.getFeatures(mixture.index1).getGroundColor();
    const color2 = this.getFeatures(mixture.index2).getGroundColor();

    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  public getBiomeScreenTint(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

    const color1 = this.getFeatures(mixture.index1).getScreenTint();
    const color2 = this.getFeatures(mixture.index2).getScreenTint();

    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  public getBiomeSkyGradient(worldZ: number, dayness: number): { top: THREE.Color, bottom: THREE.Color } {
    const mixture = this.getBiomeMixture(worldZ);

    // Get sky gradient for each biome
    const sky1 = this.getFeatures(mixture.index1).getSkyColors(dayness);
    const sky2 = this.getFeatures(mixture.index2).getSkyColors(dayness);

    // Blend the two sky gradients based on mixture weights
    const top = sky1.top.clone().multiplyScalar(mixture.weight1).add(sky2.top.clone().multiplyScalar(mixture.weight2));
    const bottom = sky1.bottom.clone().multiplyScalar(mixture.weight1).add(sky2.bottom.clone().multiplyScalar(mixture.weight2));

    return { top, bottom };
  }

  public getAmplitudeMultiplier(wz: number): number {
    const mixture = this.getBiomeMixture(wz);
    const amplitude1 = this.getFeatures(mixture.index1).getAmplitudeMultiplier();
    const amplitude2 = this.getFeatures(mixture.index2).getAmplitudeMultiplier();

    const amplitudeMultiplier = amplitude1 * mixture.weight1 + amplitude2 * mixture.weight2;
    return amplitudeMultiplier;
  }

  public getRiverWidthMultiplier(worldZ: number): number {
    // Apply Swamp Modifier: Widen river significantly
    const mixture = this.getBiomeMixture(worldZ);
    const width1 = this.getFeatures(mixture.index1).getRiverWidthMultiplier();
    const width2 = this.getFeatures(mixture.index2).getRiverWidthMultiplier();

    const widthMultiplier = width1 * mixture.weight1 + width2 * mixture.weight2;
    return widthMultiplier;
  }

  public getRiverMaterialSwampFactor(worldZ: number): number {
    const mixture = this.getBiomeMixture(worldZ);
    let swampFactor = 0.0;
    const type1 = this.biomeInstances[((mixture.index1 % this.biomeInstances.length) + this.biomeInstances.length) % this.biomeInstances.length].type;
    const type2 = this.biomeInstances[((mixture.index2 % this.biomeInstances.length) + this.biomeInstances.length) % this.biomeInstances.length].type;
    if (type1 === 'swamp') swampFactor += mixture.weight1;
    if (type2 === 'swamp') swampFactor += mixture.weight2;
    return swampFactor;
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
