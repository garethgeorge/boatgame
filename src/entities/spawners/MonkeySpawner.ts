import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { Monkey } from '../../entities/obstacles/Monkey';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { AttackAnimalSpawner } from './AttackAnimalSpawner';
import { ShorePlacementOptions } from '../../managers/PlacementHelper';

export class MonkeySpawner extends AttackAnimalSpawner {
    id = 'monkeyshore';

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.1 / 15;
    }

    protected get shoreProbability(): number {
        return 1.0;
    }

    protected get shorePlacement(): ShorePlacementOptions {
        return { minDistFromBank: 2.0, maxDistFromBank: 8.0 };
    }

    protected get heightInWater(): number {
        return Monkey.HEIGHT_IN_WATER;
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: AttackAnimalOptions): Entity {
        return new Monkey(physicsEngine, options);
    }
}
