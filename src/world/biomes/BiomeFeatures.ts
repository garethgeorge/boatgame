import * as THREE from 'three';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { DecorationConfig } from '../decorators/TerrainDecorator';

export interface SkyColors {
    top: number;
    mid?: number; // Optional: Only used for rich sunsets
    bottom: number;
}

export interface SkyBiome {
    noon: SkyColors;
    sunset: SkyColors;
    night: SkyColors;
    haze: number; // 0.0 to 1.0
}

export interface BiomeFeatures {
    id: BiomeType;

    getRange(): { zMin: number, zMax: number };

    /**
     * Populate the terrain with static decorations and entities.
     */
    populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown>;

    getFogDensity(): number;
    getFogRange(): { near: number, far: number };
    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number };
    getScreenTint(): { r: number, g: number, b: number };
    getSkyBiome(): SkyBiome;
    getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number;
    getRiverWidthMultiplier(): number;

    /**
     * Allows the biome designer UI to directly edit a biome
     */
    getDecorationConfig?(): DecorationConfig | undefined;
}
