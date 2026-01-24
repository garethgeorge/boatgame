import { SpawnContext } from '../Spawnable';
import { RiverGeometrySample } from '../../world/RiverGeometry';
import { BaseSpawner } from './BaseSpawner';
import { AttackLogicName } from '../obstacles/AttackAnimal';

export interface AnimalSpawnOptions {
    context: SpawnContext;
    sample: RiverGeometrySample;
    distanceRange: [number, number];
    aggressiveness: number;
    logic?: AttackLogicName;

    // These are used for debugging so animals can be placed at an exact
    // location and then inspected visually
    disableLogic?: boolean;
    fixedAngle?: number;
    fixedHeight?: number;
}

/**
 * Common base class for all animal-related spawners (Attack, Flying, SwimAway).
 * Provides a unified interface for absolute spawning.
 */
export abstract class AnimalSpawner extends BaseSpawner {
    /**
     * Spawns an animal within a distance range from a river position.
     * @param options The spawn options.
     */
    abstract spawnAnimalAbsolute(options: AnimalSpawnOptions): boolean;
}
