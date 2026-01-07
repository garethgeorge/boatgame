import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { Alligator } from '../../entities/obstacles/Alligator';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { AttackAnimalSpawner } from './AttackAnimalSpawner';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';

export class AlligatorSpawner extends AttackAnimalSpawner {
    id = 'croc';

    constructor(private readonly baseDensity: number = 0.00265) {
        super();
    }

    protected getDensity(difficulty: number, zStart: number): number {
        const dist = Math.abs(zStart);
        if (dist < 1000) return 0;

        const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
        return this.baseDensity * ramp;
    }

    protected get shoreProbability(): number {
        return 0.3;
    }

    protected get entityRadius(): number {
        return 5.0;
    }

    protected get heightInWater(): number {
        return Alligator.HEIGHT_IN_WATER;
    }

    protected get waterPlacement(): RiverPlacementOptions {
        return {
            minDistFromBank: 3.0
        };
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: AttackAnimalOptions): Entity {
        return new Alligator(physicsEngine, options);
    }
}
