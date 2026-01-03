import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Entity } from '../../core/Entity';
import { Pterodactyl } from '../../entities/obstacles/Pterodactyl';
import { FlyingAnimalOptions } from '../obstacles/FlyingAnimal';
import { FlyingAnimalSpawner } from './FlyingAnimalSpawner';

export class PterodactylSpawner extends FlyingAnimalSpawner {
    id = 'pterodactyl';

    protected getDensity(difficulty: number, zStart: number): number {
        return 0.1 / 20;
    }

    protected spawnEntity(physicsEngine: PhysicsEngine, options: FlyingAnimalOptions): Entity {
        return new Pterodactyl(physicsEngine, options);
    }
}
