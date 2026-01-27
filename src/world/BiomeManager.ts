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

interface BiomeInstance {
  type: BiomeType;
  zMin: number;
  zMax: number;
  features: BiomeFeatures;
};

class BiomeGenerator {
  public static DEBUG_BIOME: BiomeType = undefined;

  deck: BiomeType[] = [];
  index: Map<BiomeType, number> = new Map<BiomeType, number>;

  public next(z: number, direction: number): BiomeInstance {
    const type = BiomeGenerator.DEBUG_BIOME ?? this.drawFromDeck();

    const index = this.index.get(type) ?? 0;
    this.index.set(type, index + 1);

    const features = new BIOME_CONSTRUCTORS[type](index, z, direction);
    const range = features.getRange();

    return {
      type, zMin: range.zMin, zMax: range.zMax, features
    };
  }

  private drawFromDeck(): BiomeType {
    // Each time deck is empty create a sequence
    // type1, happy, type2, happy,  ...
    // deck is popped from the top
    if (this.deck.length === 0) {
      const otherTypes: BiomeType[] = ['desert', 'forest', 'ice', 'swamp', 'jurassic'];
      const shuffled = [...otherTypes].sort(() => Math.random() - 0.5);

      for (const type of shuffled) {
        this.deck.push(type, 'happy');
      }
    }
    return this.deck.pop()!;
  }
};

export class BiomeManager {

  private readonly BIOME_TRANSITION_WIDTH = 50;

  // The active instances are generated to cover the window radius and
  // are pruned once outside the prune radius
  private readonly WINDOW_RADIUS = 2000;
  private readonly PRUNE_RADIUS = 2500;
  private activeInstances: BiomeInstance[] = [];

  // Shuffled biome sequences for creating new biomes and cycle indices
  private posGenerator: BiomeGenerator = new BiomeGenerator;
  private negGenerator: BiomeGenerator = new BiomeGenerator;

  constructor() {
    this.updateWindow(0);
  }

  public update(worldZ: number): void {
    this.updateWindow(worldZ);
  }

  private debugCheckZ(worldZ: number): void {
    const first = this.activeInstances[0];
    const last = this.activeInstances[this.activeInstances.length - 1];

    if (!first || !last) return;

    if (worldZ < first.zMin || worldZ > last.zMax) {
      console.warn(`[BiomeManager] worldZ ${worldZ} is outside the active biome window [${first.zMin}, ${last.zMax}]!`);
    }
  }

  /**
   * Updates the active biome instances to ensure they cover the requested window [worldZ - WINDOW_RADIUS, worldZ + WINDOW_RADIUS]
   * plus at least one additional biome in both directions for sampling safety.
   * Includes hysteresis via PRUNE_RADIUS to prevent biome flickering.
   */
  private updateWindow(worldZ: number): void {
    const minRequiredZ = worldZ - this.WINDOW_RADIUS;
    const maxRequiredZ = worldZ + this.WINDOW_RADIUS;
    const minPruneZ = worldZ - this.PRUNE_RADIUS;
    const maxPruneZ = worldZ + this.PRUNE_RADIUS;

    // --- Negative Z Side ---

    // 1. Prune: Remove if the 3rd instance already covers the prune boundary.
    while (this.activeInstances.length > 2 && this.activeInstances[2].zMin < minPruneZ) {
      this.activeInstances.shift();
    }

    // 2. Grow: Add instances until the 2nd instance covers the window edge.
    while (this.activeInstances.length < 2 || this.activeInstances[1].zMin > minRequiredZ) {
      const currentZMin = this.activeInstances.length > 0 ? this.activeInstances[0].zMin : worldZ;
      this.activeInstances.unshift(this.negGenerator.next(currentZMin, -1));
    }

    // --- Positive Z Side ---

    // 1. Prune: Remove if the 3rd from end already covers the prune boundary.
    while (this.activeInstances.length > 2 && this.activeInstances[this.activeInstances.length - 3].zMax > maxPruneZ) {
      this.activeInstances.pop();
    }

    // 2. Grow: Add instances until the 2nd from end covers the window edge.
    while (this.activeInstances.length < 2 || this.activeInstances[this.activeInstances.length - 2].zMax < maxRequiredZ) {
      const len = this.activeInstances.length;
      const currentZMax = len > 0 ? this.activeInstances[len - 1].zMax : worldZ;
      this.activeInstances.push(this.posGenerator.next(currentZMax, 1));
    }
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
    if (this.activeInstances.length === 0) return null as any;
    if (worldZ <= this.activeInstances[0].zMin) return this.activeInstances[0];
    return this.activeInstances[this.activeInstances.length - 1];
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
      // near to zMin of this biome
      const otherZ = instance.zMin - 0.001;
      const otherInstance = this.getBiomeInstanceAt(otherZ);
      features2 = otherInstance.features;

      const t = distFromMin / (transitionWidth / 2);
      weight1 = this.lerp(0.5, 1.0, t);
      weight2 = 1.0 - weight1;
    } else if (distFromMax < transitionWidth / 2) {
      // near to zMax of this biome
      const otherZ = instance.zMax + 0.001;
      const otherInstance = this.getBiomeInstanceAt(otherZ);
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
