import { Spawnable, SpawnContext } from '../Spawnable';
import { RiverSystem } from '../../world/RiverSystem';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { AttackAnimalOptions } from '../obstacles/AttackAnimal';
import { Entity } from '../../core/Entity';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';

export abstract class BaseSpawner implements Spawnable {
    abstract id: string;

    protected abstract getDensity(difficulty: number, zStart: number): number;

    getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
        const chunkLength = zEnd - zStart;
        const density = this.getDensity(difficulty, zStart);
        const count = chunkLength * density;

        // Use floor(count + random) to handle fractional parts probabilistically
        return Math.floor(count + Math.random());
    }

    abstract spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void>;
}
