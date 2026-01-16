import { AttackAnimalSpawnConfig, AttackAnimalSpawner } from './AttackAnimalSpawner';
import { FlyingAnimalSpawnConfig, FlyingAnimalSpawner } from './FlyingAnimalSpawner';
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
import { Butterfly } from '../obstacles/Butterfly';
import { Pterodactyl } from '../obstacles/Pterodactyl';

import { BuoySpawner } from './BuoySpawner';
import { IcebergSpawner } from './IcebergSpawner';
import { LogSpawner } from './LogSpawner';
import { MangroveSpawner } from './MangroveSpawner';
import { MessageInABottleSpawner } from './MessageInABottleSpawner';
import { PenguinKayakSpawner } from './PenguinKayakSpawner';
import { PierSpawner } from './PierSpawner';
import { RockSpawner } from './RockSpawner';
import { WaterGrassSpawner } from './WaterGrassSpawner';

export class EntitySpawners {
    private static instance: EntitySpawners;

    private attackAnimalSpawners: Map<string, AttackAnimalSpawner> = new Map();
    private flyingAnimalSpawners: Map<string, FlyingAnimalSpawner> = new Map();

    private _buoy: BuoySpawner = new BuoySpawner();
    private _iceBerg: IcebergSpawner = new IcebergSpawner();
    private _log: LogSpawner = new LogSpawner();
    private _mangrove: MangroveSpawner = new MangroveSpawner();
    private _messageInABottle: MessageInABottleSpawner = new MessageInABottleSpawner();
    private _penguinKayak: PenguinKayakSpawner = new PenguinKayakSpawner();
    private _pier: PierSpawner = new PierSpawner();
    private _rock: RockSpawner = new RockSpawner();
    private _waterGrass: WaterGrassSpawner = new WaterGrassSpawner();

    private attackConfigs: AttackAnimalSpawnConfig[] = [
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

    private flyingConfigs: FlyingAnimalSpawnConfig[] = [
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
        for (const config of this.attackConfigs) {
            this.attackAnimalSpawners.set(config.id, new AttackAnimalSpawner(config));
        }
        for (const config of this.flyingConfigs) {
            this.flyingAnimalSpawners.set(config.id, new FlyingAnimalSpawner(config));
        }
    }

    public static getInstance(): EntitySpawners {
        if (!EntitySpawners.instance) {
            EntitySpawners.instance = new EntitySpawners();
        }
        return EntitySpawners.instance;
    }

    public attackAnimal(id: string): AttackAnimalSpawner | undefined {
        return this.attackAnimalSpawners.get(id);
    }

    public flyingAnimal(id: string): FlyingAnimalSpawner | undefined {
        return this.flyingAnimalSpawners.get(id);
    }

    public buoy(): BuoySpawner { return this._buoy; }
    public iceBerg(): IcebergSpawner { return this._iceBerg; }
    public log(): LogSpawner { return this._log; }
    public mangrove(): MangroveSpawner { return this._mangrove; }
    public messageInABottle(): MessageInABottleSpawner { return this._messageInABottle; }
    public penguinKayak(): PenguinKayakSpawner { return this._penguinKayak; }
    public pier(): PierSpawner { return this._pier; }
    public rock(): RockSpawner { return this._rock; }
    public waterGrass(): WaterGrassSpawner { return this._waterGrass; }
}
