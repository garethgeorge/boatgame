import * as THREE from 'three';
import { BiomeFeatures, SkyBiome, SkyColors } from './biomes/BiomeFeatures';
import { BiomeType } from './biomes/BiomeType';

export interface BiomeInstance {
    type: BiomeType;
    zMin: number;
    zMax: number;
    features: BiomeFeatures;
}

export interface BiomeGenerator {
    next(z: number, direction: number): BiomeInstance;
    putBack(type: BiomeType): void;
}

export interface BiomeMixture {
    biome: BiomeFeatures;
    weight: number;
}

export class BiomeManager {

    private readonly BIOME_TRANSITION_WIDTH = 50;

    private activeInstances: BiomeInstance[] = [];

    // Pre-allocated scratch array for getBiomeMixture to avoid per-call allocation.
    // Safe because all callers consume the result synchronously before the next call.
    private static readonly _mixtureScratch: BiomeMixture[] = [
        { biome: null!, weight: 0 },
        { biome: null!, weight: 0 },
    ];


    // Scratch colors for zero-allocation blending
    private scratchColor1 = new THREE.Color();
    private scratchColor2 = new THREE.Color();
    private scratchColor3 = new THREE.Color();
    private scratchColor4 = new THREE.Color();

    // Shuffled biome sequences for creating new biomes and cycle indices
    constructor(
        private posGenerator: BiomeGenerator,
        private negGenerator: BiomeGenerator
    ) {
        this.ensureWindow(-1, 1);
    }

    public resetDesignerBiome(): void {
        console.log('[BiomeManager] Resetting designer biome');
        this.activeInstances = [];
        this.ensureWindow(-1, 1);
    }

    public getDesignerBiome(): BiomeFeatures | undefined {
        // In designer mode, the target biome starts at z=0 and goes in direction 1 or -1
        // We can just look for the first instance that isn't 'null'
        const designerInstance = this.activeInstances.find(inst => inst.type !== 'null');
        return designerInstance ? designerInstance.features : undefined;
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
     * Updates the active biome instances to ensure they cover the requested window
     * plus at least one additional biome in both directions for sampling safety.
     * Hence on completion the active biomes are a contiguous sequence with:
     * - activeInstances[1].zMin <= min z
     * - max z <= activeInstances[lenght-2].zMax
     * So there is at least one extra biome on each end
     */
    public ensureWindow(minRequiredZ: number, maxRequiredZ: number): void {
        // --- Negative Z Side ---

        // Grow: Add instances until the 2nd instance covers the window edge.
        while (this.activeInstances.length < 2 || this.activeInstances[1].zMin > minRequiredZ) {
            const currentZMin = this.activeInstances.length > 0 ? this.activeInstances[0].zMin : 0;
            const instance = this.negGenerator.next(currentZMin, -1);
            this.activeInstances.unshift(instance);
        }

        // --- Positive Z Side ---

        // Grow: Add instances until the 2nd from end covers the window edge.
        while (this.activeInstances.length < 2 || this.activeInstances[this.activeInstances.length - 2].zMax < maxRequiredZ) {
            const len = this.activeInstances.length;
            const currentZMax = len > 0 ? this.activeInstances[len - 1].zMax : 0;
            const instance = this.posGenerator.next(currentZMax, 1);
            this.activeInstances.push(instance);
        }
    }

    /**
     * Updates the active biome instances to remove any not needed in order to
     * cover the requested window plus at least one additional biome in both directions
     * for sampling safety.
     */
    public pruneWindow(minRequiredZ: number, maxRequiredZ: number): void {

        // Add a little to avoid wobble causing biomes to be repeatedly added and pruned
        const minPruneZ = minRequiredZ - 200;
        const maxPruneZ = maxRequiredZ + 200;

        // --- Negative Z Side ---

        // Prune: Remove if the 3rd instance already covers the prune boundary.
        while (this.activeInstances.length > 2 && this.activeInstances[2].zMin < minPruneZ) {
            const pruned = this.activeInstances.shift()!;
            this.negGenerator.putBack(pruned.type);
        }

        // --- Positive Z Side ---

        // Prune: Remove if the 3rd from end already covers the prune boundary.
        while (this.activeInstances.length > 2 && this.activeInstances[this.activeInstances.length - 3].zMax > maxPruneZ) {
            const pruned = this.activeInstances.pop()!;
            this.posGenerator.putBack(pruned.type);
        }
    }

    /**
     * Finds the biome instance containing the given worldZ
     */
    private getBiomeInstanceAt(worldZ: number): BiomeInstance | null {
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
        if (this.activeInstances.length === 0) return null;
        if (worldZ <= this.activeInstances[0].zMin) return this.activeInstances[0];
        return this.activeInstances[this.activeInstances.length - 1];
    }

    public getBiomeAt(worldZ: number): BiomeFeatures | null {
        const instance = this.getBiomeInstanceAt(worldZ);
        return instance ? instance.features : null;
    }

    public getBiomeBoundaries(worldZ: number): { zMin: number, zMax: number } | null {
        const instance = this.getBiomeInstanceAt(worldZ);
        if (!instance) return null;
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
            if (!instance) break;
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

    /**
     * Writes biome mixture into the static scratch array and returns the count (1 or 2).
     * Callers must read results from BiomeManager._mixtureScratch before the next call.
     */
    private getBiomeMixture(worldZ: number): number {
        const scratch = BiomeManager._mixtureScratch;
        const transitionWidth = this.BIOME_TRANSITION_WIDTH;
        const instance = this.getBiomeInstanceAt(worldZ);
        if (!instance) return 0;

        const features1 = instance.features;
        const distFromMin = Math.abs(worldZ - instance.zMin);
        const distFromMax = Math.abs(worldZ - instance.zMax);

        if (distFromMin < transitionWidth / 2) {
            // near to zMin of this biome
            const otherZ = instance.zMin - 0.001;
            const otherInstance = this.getBiomeInstanceAt(otherZ);
            if (!otherInstance) {
                scratch[0].biome = features1; scratch[0].weight = 1;
                return 1;
            }

            const t = distFromMin / (transitionWidth / 2);
            const weight1 = this.lerp(0.5, 1.0, t);
            scratch[0].biome = features1; scratch[0].weight = weight1;
            scratch[1].biome = otherInstance.features; scratch[1].weight = 1.0 - weight1;
            return 2;
        } else if (distFromMax < transitionWidth / 2) {
            // near to zMax of this biome
            const otherZ = instance.zMax + 0.001;
            const otherInstance = this.getBiomeInstanceAt(otherZ);
            if (!otherInstance) {
                scratch[0].biome = features1; scratch[0].weight = 1;
                return 1;
            }

            const t = (transitionWidth / 2 - distFromMax) / (transitionWidth / 2);
            const weight1 = this.lerp(1.0, 0.5, t);
            scratch[0].biome = features1; scratch[0].weight = weight1;
            scratch[1].biome = otherInstance.features; scratch[1].weight = 1.0 - weight1;
            return 2;
        }

        scratch[0].biome = features1; scratch[0].weight = 1;
        return 1;
    }

    public getBiomeFogDensity(worldZ: number): number {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(worldZ);
        const d1 = scratch[0].biome.getFogDensity();
        if (count === 1) return d1;
        const d2 = scratch[1].biome.getFogDensity();
        return d1 * scratch[0].weight + d2 * scratch[1].weight;
    }

    public getBiomeFogRange(worldZ: number): { near: number, far: number } {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(worldZ);
        const r1 = scratch[0].biome.getFogRange();
        if (count === 1) return r1;
        const r2 = scratch[1].biome.getFogRange();
        return {
            near: this.lerp(r1.near, r2.near, scratch[1].weight),
            far: this.lerp(r1.far, r2.far, scratch[1].weight)
        };
    }

    public getBiomeGroundColor(worldX: number, worldY: number, worldZ: number, distFromBank: number): { r: number, g: number, b: number } {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(worldZ);
        const c1 = scratch[0].biome.getGroundColor(worldX, worldY, worldZ, distFromBank);
        if (count === 1) return c1;
        const c2 = scratch[1].biome.getGroundColor(worldX, worldY, worldZ, distFromBank);
        return {
            r: c1.r * scratch[0].weight + c2.r * scratch[1].weight,
            g: c1.g * scratch[0].weight + c2.g * scratch[1].weight,
            b: c1.b * scratch[0].weight + c2.b * scratch[1].weight
        };
    }

    public getBiomeScreenTint(worldZ: number): { r: number, g: number, b: number } {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(worldZ);
        const c1 = scratch[0].biome.getScreenTint();
        if (count === 1) return c1;
        const c2 = scratch[1].biome.getScreenTint();
        return {
            r: c1.r * scratch[0].weight + c2.r * scratch[1].weight,
            g: c1.g * scratch[0].weight + c2.g * scratch[1].weight,
            b: c1.b * scratch[0].weight + c2.b * scratch[1].weight
        };
    }

    public getBiomeSkyBiome(worldZ: number): SkyBiome {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(worldZ);
        const s1 = scratch[0].biome.getSkyBiome();
        if (count === 1) return s1;
        const s2 = scratch[1].biome.getSkyBiome();

        const w2 = scratch[1].weight;

        return {
            noon: this.lerpSkyColors(s1.noon, s2.noon, w2),
            sunset: this.lerpSkyColors(s1.sunset, s2.sunset, w2),
            night: this.lerpSkyColors(s1.night, s2.night, w2),
            haze: this.lerp(s1.haze, s2.haze, w2)
        };
    }

    private lerpSkyColors(c1: SkyColors, c2: SkyColors, t: number): { top: number, mid: number, bottom: number } {
        const colorTop = this.scratchColor1.set(c1.top).lerp(this.scratchColor2.set(c2.top), t);
        const hexTop = colorTop.getHex();

        const colorBottom = this.scratchColor3.set(c1.bottom).lerp(this.scratchColor4.set(c2.bottom), t);
        const hexBottom = colorBottom.getHex();

        const getMid = (c: SkyColors, color: THREE.Color) => {
            if (c.mid !== undefined) return color.set(c.mid);
            return color.set(c.top).lerp(this.scratchColor2.set(c.bottom), 0.5);
        };

        // Reuse scratchColor1 after getting its hex
        const colorMid = getMid(c1, this.scratchColor1).lerp(getMid(c2, this.scratchColor2), t);
        const hexMid = colorMid.getHex();

        return {
            top: hexTop,
            mid: hexMid,
            bottom: hexBottom
        };
    }

    public getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(wz);
        const amplitude1 = scratch[0].biome.getAmplitudeMultiplier(wx, wz, distFromBank);
        if (count === 1) return amplitude1;
        const amplitude2 = scratch[1].biome.getAmplitudeMultiplier(wx, wz, distFromBank);

        const amplitudeMultiplier = amplitude1 * scratch[0].weight + amplitude2 * scratch[1].weight;
        return amplitudeMultiplier;
    }

    public getRiverWidthMultiplier(worldZ: number): number {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(worldZ);
        const width1 = scratch[0].biome.getRiverWidthMultiplier();
        if (count === 1) return width1;
        const width2 = scratch[1].biome.getRiverWidthMultiplier();

        const widthMultiplier = width1 * scratch[0].weight + width2 * scratch[1].weight;
        return widthMultiplier;
    }

    public getRiverMaterialSwampFactor(worldZ: number): number {
        const scratch = BiomeManager._mixtureScratch;
        const count = this.getBiomeMixture(worldZ);

        let swampFactor = 0.0;
        const type1 = scratch[0].biome.id;
        if (type1 === 'swamp') swampFactor += scratch[0].weight;
        if (count === 1) return swampFactor;

        const type2 = scratch[1].biome.id;
        if (type2 === 'swamp') swampFactor += scratch[1].weight;
        return swampFactor;
    }

    private lerp(start: number, end: number, t: number): number {
        return start * (1 - t) + end * t;
    }
}
