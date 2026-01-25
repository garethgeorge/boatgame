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
  zMin: number;
  zMax: number;
  features: BiomeFeatures;
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

  private readonly BIOME_TRANSITION_WIDTH = 50;

  // The active instances are generated to cover the window radius and
  // are pruned once outside the prune radius
  private readonly WINDOW_RADIUS = 2000;
  private readonly PRUNE_RADIUS = 2500;
  private activeInstances: BiomeInstance[] = [];

  // A shuffled biome sequences for creating new biomes.
  private posDeck: BiomeType[] = [];
  private negDeck: BiomeType[] = [];

  constructor() {
    // Start with two back to back happy biomes so the boat is surrounded
    // in both directions
    const type = 'happy';
    const length = BIOME_LENGTHS[type];

    this.activeInstances.push({
      type, zMin: -length, zMax: 0, features: new BIOME_CONSTRUCTORS[type](-length, 0)
    });
    this.activeInstances.push({
      type, zMin: 0, zMax: length, features: new BIOME_CONSTRUCTORS[type](-length, 0)
    });
  }

  public update(worldZ: number): void {
    this.ensureWindow(worldZ);
    this.pruneActiveInstances(worldZ);
  }

  private debugCheckZ(worldZ: number): void {
    const first = this.activeInstances[0];
    const last = this.activeInstances[this.activeInstances.length - 1];

    if (!first || !last) return;

    if (worldZ < first.zMin || worldZ > last.zMax) {
      console.warn(`[BiomeManager] worldZ ${worldZ} is outside the active biome window [${first.zMin}, ${last.zMax}]!`);
    }
  }

  private drawFromDeck(deck: BiomeType[]): BiomeType {
    // Each time deck is empty create a sequence
    // happy, type1, happy, type2,  ...
    // deck is popped from the top
    if (deck.length === 0) {
      const otherTypes: BiomeType[] = ['desert', 'forest', 'ice', 'swamp', 'jurassic'];
      const shuffled = [...otherTypes].sort(() => Math.random() - 0.5);

      for (const type of shuffled) {
        deck.push('happy', type);
      }
    }
    return deck.pop()!;
  }

  private ensureWindow(worldZ: number): void {
    // Grow Negative Z (forward)
    while (true) {
      const currentZMin = this.activeInstances.length > 0 ? this.activeInstances[0].zMin : Infinity;
      if (currentZMin <= worldZ - this.WINDOW_RADIUS) break;

      const type = BiomeManager.DEBUG_BIOME ? 'test' : this.drawFromDeck(this.negDeck);
      const length = BIOME_LENGTHS[type];
      const zMax = currentZMin;
      const zMin = currentZMin - length;

      this.activeInstances.unshift({
        type,
        zMin,
        zMax,
        features: new BIOME_CONSTRUCTORS[type](zMin, zMax)
      });
    }

    // Grow Positive Z (backward)
    while (true) {
      const currentZMax = this.activeInstances.length > 0 ? this.activeInstances[this.activeInstances.length - 1].zMax : -Infinity;
      if (currentZMax >= worldZ + this.WINDOW_RADIUS) break;

      const type = BiomeManager.DEBUG_BIOME ? 'test' : this.drawFromDeck(this.posDeck);
      const length = BIOME_LENGTHS[type];
      const zMin = currentZMax;
      const zMax = currentZMax + length;

      this.activeInstances.push({
        type,
        zMin,
        zMax,
        features: new BIOME_CONSTRUCTORS[type](zMin, zMax)
      });
    }
  }

  private pruneActiveInstances(currentZ: number): void {
    this.activeInstances = this.activeInstances.filter(inst => {
      // if instance is to the "right" keep so long as its start is in range
      if (currentZ < inst.zMin)
        return inst.zMin - currentZ <= this.PRUNE_RADIUS;
      // if instance is to the "left" keep so long as its end is in range
      if (inst.zMax < currentZ)
        return currentZ - inst.zMax <= this.PRUNE_RADIUS;
      // overlaps so definitely keep
      return true;
    });
  }

  /**
   * Finds the biome instance containing the given worldZ
   */
  private getBiomeInstanceAt(worldZ: number): BiomeInstance {
    this.debugCheckZ(worldZ);

    let low = 0;
    let high = this.activeInstances.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const instance = this.activeInstances[mid];

      // worldZ is in biome if zMin < worldZ <= zMax
      if (worldZ > instance.zMin && worldZ <= instance.zMax) {
        return instance;
      } else if (worldZ <= instance.zMin) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Fallback to closest if not found (shouldn't happen with ensureZReached)
    return this.activeInstances[0];
  }

  public getBiomeBoundaries(worldZ: number): { zMin: number, zMax: number } {
    const instance = this.getBiomeInstanceAt(worldZ);
    return {
      zMin: instance.zMin,
      zMax: instance.zMax
    };
  }

  public getFeatureSegments(zMin: number, zMax: number): Array<{
    features: BiomeFeatures,
    zMin: number, zMax: number,
    biomeZMin: number, biomeZMax: number
  }> {
    const segments: Array<{
      features: BiomeFeatures,
      zMin: number, zMax: number,
      biomeZMin: number, biomeZMax: number
    }> = [];

    // Both boundaries should be reached via the update loop.
    this.debugCheckZ(zMin);
    this.debugCheckZ(zMax);

    let currentZ = zMin;
    const direction = zMax < zMin ? -1 : 1;

    while (direction === 1 ? currentZ < zMax : currentZ > zMax) {
      // Sample slightly ahead to ensure we cross biome boundaries and avoid infinite loops
      const sampleZ = currentZ + direction * 0.001;
      const instance = this.getBiomeInstanceAt(sampleZ);
      const segmentEnd = direction === 1 ? Math.min(zMax, instance.zMax) : Math.max(zMax, instance.zMin);

      segments.push({
        features: instance.features,
        zMin: currentZ,
        zMax: segmentEnd,
        biomeZMin: instance.zMin,
        biomeZMax: instance.zMax,
      });
      currentZ = segmentEnd;
    }

    return segments;
  }

  private getBiomeMixture(worldZ: number): {
    features1: BiomeFeatures,
    features2: BiomeFeatures,
    weight1: number,
    weight2: number
  } {
    const transitionWidth = this.BIOME_TRANSITION_WIDTH;
    const instance = this.getBiomeInstanceAt(worldZ);

    let features1 = instance.features;
    let features2 = instance.features;
    let weight1 = 1.0;
    let weight2 = 0.0;

    const distFromMin = Math.abs(worldZ - instance.zMin);
    const distFromMax = Math.abs(worldZ - instance.zMax);

    if (distFromMin < transitionWidth / 2) {
      const otherZ = instance.zMin - 0.001;
      const otherInstance = this.getBiomeInstanceAt(otherZ);
      features1 = instance.features;
      features2 = otherInstance.features;

      const t = distFromMin / (transitionWidth / 2);
      weight1 = this.lerp(0.5, 1.0, t);
      weight2 = 1.0 - weight1;
    } else if (distFromMax < transitionWidth / 2) {
      const otherZ = instance.zMax + 0.001;
      const otherInstance = this.getBiomeInstanceAt(otherZ);
      features1 = instance.features;
      features2 = otherInstance.features;

      const t = (transitionWidth / 2 - distFromMax) / (transitionWidth / 2);
      weight1 = this.lerp(1.0, 0.5, t);
      weight2 = 1.0 - weight1;
    }

    return { features1, features2, weight1, weight2 };
  }

  public getBiomeFogDensity(worldZ: number): number {
    const mixture = this.getBiomeMixture(worldZ);
    const d1 = mixture.features1.getFogDensity();
    const d2 = mixture.features2.getFogDensity();
    return d1 * mixture.weight1 + d2 * mixture.weight2;
  }

  public getBiomeFogRange(worldZ: number): { near: number, far: number } {
    const mixture = this.getBiomeMixture(worldZ);
    const range1 = mixture.features1.getFogRange();
    const range2 = mixture.features2.getFogRange();

    return {
      near: this.lerp(range1.near, range2.near, mixture.weight2), // weight2 is t from 1 to 2
      far: this.lerp(range1.far, range2.far, mixture.weight2)
    };
  }

  public getBiomeGroundColor(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

    const color1 = mixture.features1.getGroundColor();
    const color2 = mixture.features2.getGroundColor();

    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  public getBiomeScreenTint(worldZ: number): { r: number, g: number, b: number } {
    const mixture = this.getBiomeMixture(worldZ);

    const color1 = mixture.features1.getScreenTint();
    const color2 = mixture.features2.getScreenTint();

    return {
      r: color1.r * mixture.weight1 + color2.r * mixture.weight2,
      g: color1.g * mixture.weight1 + color2.g * mixture.weight2,
      b: color1.b * mixture.weight1 + color2.b * mixture.weight2
    };
  }

  public getBiomeSkyGradient(worldZ: number, dayness: number): { top: THREE.Color, bottom: THREE.Color } {
    const mixture = this.getBiomeMixture(worldZ);

    // Get sky gradient for each biome
    const sky1 = mixture.features1.getSkyColors(dayness);
    const sky2 = mixture.features2.getSkyColors(dayness);

    // Blend the two sky gradients based on mixture weights
    const top = sky1.top.clone().multiplyScalar(mixture.weight1).add(sky2.top.clone().multiplyScalar(mixture.weight2));
    const bottom = sky1.bottom.clone().multiplyScalar(mixture.weight1).add(sky2.bottom.clone().multiplyScalar(mixture.weight2));

    return { top, bottom };
  }

  public getAmplitudeMultiplier(wz: number): number {
    const mixture = this.getBiomeMixture(wz);
    const amplitude1 = mixture.features1.getAmplitudeMultiplier();
    const amplitude2 = mixture.features2.getAmplitudeMultiplier();

    const amplitudeMultiplier = amplitude1 * mixture.weight1 + amplitude2 * mixture.weight2;
    return amplitudeMultiplier;
  }

  public getRiverWidthMultiplier(worldZ: number): number {
    // Apply Swamp Modifier: Widen river significantly
    const mixture = this.getBiomeMixture(worldZ);
    const width1 = mixture.features1.getRiverWidthMultiplier();
    const width2 = mixture.features2.getRiverWidthMultiplier();

    const widthMultiplier = width1 * mixture.weight1 + width2 * mixture.weight2;
    return widthMultiplier;
  }

  public getRiverMaterialSwampFactor(worldZ: number): number {
    const mixture = this.getBiomeMixture(worldZ);
    let swampFactor = 0.0;
    const type1 = mixture.features1.id;
    const type2 = mixture.features2.id;
    if (type1 === 'swamp') swampFactor += mixture.weight1;
    if (type2 === 'swamp') swampFactor += mixture.weight2;
    return swampFactor;
  }

  private lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }
}
