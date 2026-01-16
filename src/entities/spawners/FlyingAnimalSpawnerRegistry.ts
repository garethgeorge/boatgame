import { FlyingAnimalSpawnConfig, FlyingAnimalSpawner } from './FlyingAnimalSpawner';
import { EntityIds } from '../EntityIds';
import { Butterfly } from '../obstacles/Butterfly';
import { Pterodactyl } from '../obstacles/Pterodactyl';

export class FlyingAnimalSpawnerRegistry {
    private static instance: FlyingAnimalSpawnerRegistry;
    private spawners: Map<string, FlyingAnimalSpawner> = new Map();

    private configs: FlyingAnimalSpawnConfig[] = [
        {
            id: EntityIds.BUTTERFLY,
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Butterfly(physicsEngine, options),
            entityRadius: 0.5
        },
        {
            id: EntityIds.PTERODACTYL,
            getDensity: () => 0.1 / 20,
            factory: (physicsEngine, options) => new Pterodactyl(physicsEngine, options)
        }
    ];

    private constructor() {
        for (const config of this.configs) {
            this.spawners.set(config.id, new FlyingAnimalSpawner(config));
        }
    }

    public static getInstance(): FlyingAnimalSpawnerRegistry {
        if (!FlyingAnimalSpawnerRegistry.instance) {
            FlyingAnimalSpawnerRegistry.instance = new FlyingAnimalSpawnerRegistry();
        }
        return FlyingAnimalSpawnerRegistry.instance;
    }

    public getSpawner(id: string): FlyingAnimalSpawner | undefined {
        return this.spawners.get(id);
    }

    public getAllSpawners(): FlyingAnimalSpawner[] {
        return Array.from(this.spawners.values());
    }
}
