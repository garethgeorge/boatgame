import * as THREE from 'three';
import { DecorationContext } from '../decorators/DecorationContext';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';

export interface BiomeFeatures {
    id: BiomeType;

    getRange(): { zMin: number, zMax: number };

    /**
     * Decorate the terrain with static meshes (trees, rocks, etc.)
     */
    decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown>;

    /**
     * Spawn entities (animals, obstacles, etc.)
     */
    spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown>;

    getFogDensity(): number;
    getFogRange(): { near: number, far: number };
    getGroundColor(): { r: number, g: number, b: number };
    getScreenTint(): { r: number, g: number, b: number };
    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color };
    getAmplitudeMultiplier(): number;
    getRiverWidthMultiplier(): number;

    /**
     * These allow the biome designer UI to directly edit a biome
     */
    getDecorationRules?(): any[] | undefined;
    setDecorationRules?(rules: any[]): void;
}
