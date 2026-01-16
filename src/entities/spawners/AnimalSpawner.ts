import { SpawnContext } from '../Spawnable';
import { RiverGeometrySample } from '../../world/RiverGeometry';
import { BaseSpawner } from './BaseSpawner';

/**
 * Common base class for all animal-related spawners (Attack, Flying, SwimAway).
 * Provides a unified interface for absolute spawning.
 */
export abstract class AnimalSpawner extends BaseSpawner {
    /**
     * Spawns an animal within a distance range from a river position.
     * @param context The spawn context.
     * @param sample The river geometry sample.
     * @param distanceRange The range along the normal vector [min, max].
     * @param aggressiveness The aggressiveness/difficulty factor [0-1].
     */
    abstract spawnAnimalAbsolute(
        context: SpawnContext,
        sample: RiverGeometrySample,
        distanceRange: [number, number],
        aggressiveness: number,
        logic?: string
    ): Promise<boolean>;
}
