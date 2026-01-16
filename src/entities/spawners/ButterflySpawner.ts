import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { Butterfly } from '../../entities/obstacles/Butterfly';
import { FlyingAnimalOptions } from '../obstacles/FlyingAnimal';
import { FlyingAnimalSpawner } from './FlyingAnimalSpawner';

export class ButterflySpawner extends FlyingAnimalSpawner {
    id = 'butterfly';

    protected override get entityRadius(): number {
        return 0.5;
    }

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.5 / 20; // More frequent than pterodactyls
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: FlyingAnimalOptions): Entity {
        return new Butterfly(physicsEngine, options);
    }
}
