import { Color3 } from '@babylonjs/core';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';

export interface BiomeFeatures {
    id: BiomeType;

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
    getSkyColors(dayness: number): { top: Color3, bottom: Color3 };
    getAmplitudeMultiplier(): number;
    getRiverWidthMultiplier(): number;
}
