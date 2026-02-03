import * as THREE from 'three';
import { SpawnContext } from '../Spawnable';
import { AnimalBehaviorConfig } from '../behaviors/AnimalBehaviorConfigs';
import { AnimalClass } from '../obstacles/Animal';
/**
 * Spawn options. All parameters are optional so that options can be created
 * by combining partial sets.
 */
export interface AnimalSpawnOptions {
    aggressiveness: number;
    biomeZRange: [number, number];
    behavior: AnimalBehaviorConfig;
}

/**
 * Concrete implementation for all animal-related spawners (Attack, Swimming, Shore).
 */
export class AnimalSpawner {
    public static createEntity(factory: AnimalClass, context: SpawnContext,
        x: number, z: number, angle: number, height: number, normal: THREE.Vector3,
        options: AnimalSpawnOptions) {
        const entity = new factory(context.physicsEngine, {
            x: x, y: z, angle, height, terrainNormal: normal,
            aggressiveness: options.aggressiveness ?? 0.5,
            behavior: options.behavior,
            zRange: options.biomeZRange
        });
        if (entity) {
            context.entityManager.add(entity);
            return true;
        }
        return false;
    }
}
