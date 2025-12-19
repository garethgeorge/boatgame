import { AttackAnimalSpawner } from './AttackAnimalSpawner';
import { SpawnContext } from '../Spawnable';
import { Triceratops } from '../obstacles/Triceratops';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverPlacementOptions, ShorePlacementOptions } from '../../managers/PlacementHelper';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { Entity } from '../../core/Entity';

export class TriceratopsSpawner extends AttackAnimalSpawner {
    id = 'triceratops';

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
        return Triceratops.HEIGHT_IN_WATER;
    }
    protected get shorePlacement(): ShorePlacementOptions {
        return { minDistFromBank: 3.0, maxDistFromBank: 6.0 };
    }
    protected get waterPlacement(): RiverPlacementOptions {
        return { minDistFromBank: 3.0 };
    }

    protected spawnEntity(physicsEngine: PhysicsEngine,
        options: AttackAnimalOptions): Entity {
        return new Triceratops(physicsEngine, options);
    }
}
