import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { PolarBear } from '../../entities/obstacles/PolarBear';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { AttackAnimalSpawner } from './AttackAnimalSpawner';
import { ShorePlacementOptions } from '../../managers/PlacementHelper';

export class PolarBearSpawner extends AttackAnimalSpawner {
    id = 'polarbear';

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.1 / 15;
    }

    protected get shoreProbability(): number {
        return 1.0;
    }

    protected get shorePlacement(): ShorePlacementOptions {
        return { minDistFromBank: 2.5, maxDistFromBank: 3.0 };
    }

    protected get heightInWater(): number {
        return PolarBear.HEIGHT_IN_WATER;
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: AttackAnimalOptions): Entity {
        return new PolarBear(physicsEngine, options);
    }
}
