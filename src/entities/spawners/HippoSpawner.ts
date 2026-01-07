import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { Hippo } from '../../entities/obstacles/Hippo';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { AttackAnimalSpawner } from './AttackAnimalSpawner';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';

export class HippoSpawner extends AttackAnimalSpawner {
    id = 'hippo';

    protected getDensity(difficulty: number, zStart: number): number {
        const dist = Math.abs(zStart);
        if (dist < 1000) return 0;

        const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
        return 0.00265 * ramp;
    }

    protected get shoreProbability(): number {
        return 0.0;
    }

    protected get entityRadius(): number {
        return 5.0;
    }

    protected get heightInWater(): number {
        return Hippo.HEIGHT_IN_WATER;
    }

    protected get waterPlacement(): RiverPlacementOptions {
        return {
            minDistFromBank: 3.0
        };
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: AttackAnimalOptions): Entity {
        return new Hippo(physicsEngine, options);
    }
}
