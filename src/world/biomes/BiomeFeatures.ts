import { DecorationContext } from '../decorators/TerrainDecorator';
import { SpawnContext, BiomeType } from '../../entities/Spawnable';

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
}
