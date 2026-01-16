import { AttackAnimalSpawnConfig, AttackAnimalSpawner } from './AttackAnimalSpawner';
import { EntityIds } from '../EntityIds';
import { Alligator } from '../obstacles/Alligator';
import { Brontosaurus } from '../obstacles/Brontosaurus';
import { TRex } from '../obstacles/TRex';
import { BrownBear } from '../obstacles/BrownBear';
import { PolarBear } from '../obstacles/PolarBear';
import { Hippo } from '../obstacles/Hippo';
import { Monkey } from '../obstacles/Monkey';
import { Moose } from '../obstacles/Moose';
import { Triceratops } from '../obstacles/Triceratops';
import { Dolphin } from '../obstacles/Dolphin';
import { Duckling } from '../obstacles/Duckling';

export class AttackAnimalSpawnerRegistry {
    private static instance: AttackAnimalSpawnerRegistry;
    private spawners: Map<string, AttackAnimalSpawner> = new Map();

    private configs: AttackAnimalSpawnConfig[] = [
        {
            id: EntityIds.ALLIGATOR,
            getDensity: (difficulty, zStart) => {
                const dist = Math.abs(zStart);
                if (dist < 1000) return 0;
                const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
                return 0.00265 * ramp;
            },
            factory: (physicsEngine, options) => new Alligator(physicsEngine, options),
            shoreProbability: 0.3,
            entityRadius: 5.0,
            heightInWater: Alligator.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.BRONTOSAURUS,
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Brontosaurus(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: 5.0,
            heightInWater: Brontosaurus.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.TREX,
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new TRex(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: 5.0,
            heightInWater: TRex.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.BROWN_BEAR,
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new BrownBear(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 2.5, maxDistFromBank: 3.0 },
            heightInWater: BrownBear.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.POLAR_BEAR,
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new PolarBear(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 2.5, maxDistFromBank: 4.0 },
            heightInWater: PolarBear.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.HIPPO,
            getDensity: (difficulty, zStart) => {
                const dist = Math.abs(zStart);
                if (dist < 1000) return 0;
                const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
                return 0.00265 * ramp;
            },
            factory: (physicsEngine, options) => new Hippo(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: 5.0,
            heightInWater: Hippo.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.MONKEY,
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Monkey(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 0.5, maxDistFromBank: 3.0 },
            heightInWater: Monkey.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.MOOSE,
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Moose(physicsEngine, options),
            shoreProbability: 0.6,
            heightInWater: Moose.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.TRICERATOPS,
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Triceratops(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: 5.0,
            heightInWater: Triceratops.HEIGHT_IN_WATER,
            shorePlacement: { minDistFromBank: 3.0, maxDistFromBank: 6.0 },
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.DOLPHIN,
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new Dolphin(options.x, options.y, physicsEngine, options.angle || 0),
            entityRadius: 2.0,
            waterPlacement: { minDistFromBank: 2.0 }
        },
        {
            id: EntityIds.DUCKLING,
            getDensity: () => 0.05,
            factory: (physicsEngine, options) => new Duckling(options.x, options.y, physicsEngine, options.angle || 0),
            entityRadius: 1.5,
            waterPlacement: { minDistFromBank: 2.0 }
        }
    ];

    private constructor() {
        for (const config of this.configs) {
            this.spawners.set(config.id, new AttackAnimalSpawner(config));
        }
    }

    public static getInstance(): AttackAnimalSpawnerRegistry {
        if (!AttackAnimalSpawnerRegistry.instance) {
            AttackAnimalSpawnerRegistry.instance = new AttackAnimalSpawnerRegistry();
        }
        return AttackAnimalSpawnerRegistry.instance;
    }

    public getSpawner(id: string): AttackAnimalSpawner | undefined {
        return this.spawners.get(id);
    }

    public getAllSpawners(): AttackAnimalSpawner[] {
        return Array.from(this.spawners.values());
    }
}
