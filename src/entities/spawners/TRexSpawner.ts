import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { TRex } from '../../entities/obstacles/TRex';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { AttackAnimalSpawner } from './AttackAnimalSpawner';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';

export class TRexSpawner extends AttackAnimalSpawner {
    id = 'trex';

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.1 / 15;
    }

    protected get shoreProbability(): number {
        return 0.6;
    }

    protected get entityRadius(): number {
        return 5.0;
    }

    protected get heightInWater(): number {
        return TRex.HEIGHT_IN_WATER;
    }

    protected get waterPlacement(): RiverPlacementOptions {
        return {
            minDistFromBank: 3.0
        };
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: AttackAnimalOptions): Entity {
        return new TRex(physicsEngine, options);
    }
}
