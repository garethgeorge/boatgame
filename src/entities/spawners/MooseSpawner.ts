import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { Moose } from '../../entities/obstacles/Moose';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { AttackAnimalSpawner } from './AttackAnimalSpawner';
import { ShorePlacementOptions } from '../../managers/PlacementHelper';

export class MooseSpawner extends AttackAnimalSpawner {
    id = 'moose';

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.1 / 15;
    }

    protected get shoreProbability(): number {
        return 1.0;
    }

    protected get shorePlacement(): ShorePlacementOptions {
        return { minDistFromBank: 3.0, maxDistFromBank: 7.0 };
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: AttackAnimalOptions): Entity {
        return new Moose(physicsEngine, options);
    }
}
