import * as THREE from 'three';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { AnimalBehaviorConfig } from '../behaviors/AnimalBehaviorConfigs';
import { Animal, AnimalClass } from '../obstacles/Animal';
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
    public static createEntity(factory: AnimalClass, context: PopulationContext,
        x: number, z: number, angle: number, height: number, normal: THREE.Vector3,
        options: AnimalSpawnOptions): Animal | null {
        const entity = new factory(context.physicsEngine, {
            x: x, y: z, angle, height,
            aggressiveness: options.aggressiveness ?? 0.5,
            behavior: options.behavior,
            zRange: options.biomeZRange
        });
        if (entity) {
            context.entityManager.add(entity);
            return entity;
        }
        return null;
    }
}
