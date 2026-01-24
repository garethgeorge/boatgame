import { AttackAnimalSpawnConfig, AttackAnimalSpawner } from './AttackAnimalSpawner';
import { FlyingAnimalSpawnConfig, FlyingAnimalSpawner } from './FlyingAnimalSpawner';
import { AnimalSpawner } from './AnimalSpawner';
import { SwimAwayAnimalSpawnConfig, SwimAwayAnimalSpawner } from './SwimAwayAnimalSpawner';
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
import { PenguinKayak } from '../obstacles/PenguinKayak';
import { Butterfly } from '../obstacles/Butterfly';
import { Pterodactyl } from '../obstacles/Pterodactyl';
import { Dragonfly } from '../obstacles/Dragonfly';

import { BuoySpawner } from './BuoySpawner';
import { IcebergSpawner } from './IcebergSpawner';
import { LogSpawner } from './LogSpawner';
import { MangroveSpawner } from './MangroveSpawner';
import { MessageInABottleSpawner } from './MessageInABottleSpawner';
import { PierSpawner } from './PierSpawner';
import { RockSpawner } from './RockSpawner';
import { WaterGrassSpawner } from './WaterGrassSpawner';
import { Bluebird } from '../obstacles/Bluebird';
import { Egret } from '../obstacles/Egret';
import { Swan } from '../obstacles/Swan';

export class EntitySpawners {
    private static instance: EntitySpawners;

    private animalSpawners: Map<string, AnimalSpawner> = new Map();

    private _buoy: BuoySpawner = new BuoySpawner();
    private _iceBerg: IcebergSpawner = new IcebergSpawner();
    private _log: LogSpawner = new LogSpawner();
    private _mangrove: MangroveSpawner = new MangroveSpawner();
    private _messageInABottle: MessageInABottleSpawner = new MessageInABottleSpawner();
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
            heightInWater: Monkey.HEIGHT_IN_WATER,
            shoreBehavior: 'walk'
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
    ];

    private flyingConfigs: FlyingAnimalSpawnConfig[] = [
        {
            id: EntityIds.BLUEBIRD,
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Bluebird(physicsEngine, options),
            entityRadius: 1.5
        },
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
        },
        {
            id: EntityIds.EGRET,
            getDensity: () => 0.1 / 20,
            factory: (physicsEngine, options) => new Egret(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: 3.0,
            heightInWater: Egret.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.DRAGONFLY,
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Dragonfly(physicsEngine, options),
            entityRadius: 1.5
        }
    ];

    private swimAwayConfigs: SwimAwayAnimalSpawnConfig[] = [
        {
            id: EntityIds.DOLPHIN,
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new Dolphin(physicsEngine, options),
            heightInWater: Dolphin.HEIGHT_IN_WATER,
            entityRadius: 2.0,
            waterPlacement: { minDistFromBank: 2.0 }
        },
        {
            id: EntityIds.DUCKLING,
            getDensity: () => 0.05,
            factory: (physicsEngine, options) => new Duckling(physicsEngine, options),
            heightInWater: Duckling.HEIGHT_IN_WATER,
            entityRadius: 1.5,
            waterPlacement: { minDistFromBank: 2.0 }
        },
        {
            id: EntityIds.PENGUIN_KAYAK,
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new PenguinKayak(physicsEngine, options),
            heightInWater: PenguinKayak.HEIGHT_IN_WATER,
            entityRadius: 1.5,
            waterPlacement: { minDistFromBank: 1.0 }
        },
        {
            id: EntityIds.SWAN,
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new Swan(physicsEngine, options),
            heightInWater: Swan.HEIGHT_IN_WATER,
            entityRadius: 2.0,
            waterPlacement: { minDistFromBank: 1.0 }
        }
    ];

    private constructor() {
        // Create Animal Spawners
        this.attackConfigs.forEach(config => {
            this.animalSpawners.set(config.id, new AttackAnimalSpawner(config));
        });

        this.flyingConfigs.forEach(config => {
            this.animalSpawners.set(config.id, new FlyingAnimalSpawner(config));
        });

        this.swimAwayConfigs.forEach(config => {
            this.animalSpawners.set(config.id, new SwimAwayAnimalSpawner(config));
        });
    }

    public static getInstance(): EntitySpawners {
        if (!EntitySpawners.instance) {
            EntitySpawners.instance = new EntitySpawners();
        }
        return EntitySpawners.instance;
    }

    public animal(id: string): AnimalSpawner | undefined {
        return this.animalSpawners.get(id);
    }

    public buoy(): BuoySpawner { return this._buoy; }
    public iceBerg(): IcebergSpawner { return this._iceBerg; }
    public log(): LogSpawner { return this._log; }
    public mangrove(): MangroveSpawner { return this._mangrove; }
    public messageInABottle(): MessageInABottleSpawner { return this._messageInABottle; }
    public pier(): PierSpawner { return this._pier; }
    public rock(): RockSpawner { return this._rock; }
    public waterGrass(): WaterGrassSpawner { return this._waterGrass; }
}
