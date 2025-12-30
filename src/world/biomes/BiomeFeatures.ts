import * as THREE from 'three';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';

export interface BiomeFeatures {
    id: BiomeType;

    /**
     * Create a lazily initialized layout for this biome instance.
     * The type is biome-specific.
     */
    createLayout(zMin: number, zMax: number): any;

    /**
     * Decorate the terrain with static meshes (trees, rocks, etc.)
     */
    decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void>;

    /**
     * Spawn entities (animals, obstacles, etc.)
     */
    spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void>;

    getFogDensity(): number;
    getFogRange(): { near: number, far: number };
    getGroundColor(): { r: number, g: number, b: number };
    getScreenTint(): { r: number, g: number, b: number };
    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color };
    getAmplitudeMultiplier(): number;
    getRiverWidthMultiplier(): number;
    getBiomeLength(): number;
}
