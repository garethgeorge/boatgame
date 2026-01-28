import { AttackAnimalSpawnConfig, AttackAnimalSpawner } from './AttackAnimalSpawner';
import { FlyingAnimalSpawnConfig, FlyingAnimalSpawner } from './FlyingAnimalSpawner';
import { AnimalSpawner } from './AnimalSpawner';
import { SwimAwayAnimalSpawnConfig, SwimAwayAnimalSpawner } from './SwimAwayAnimalSpawner';
import { ShoreAnimalSpawnConfig, ShoreAnimalSpawner } from './ShoreAnimalSpawner';
import { EntityIds } from '../EntityIds';
import { Alligator } from '../obstacles/Alligator';
import { Snake } from '../obstacles/Snake';
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
import { Turtle } from '../obstacles/Turtle';
import { Unicorn } from '../obstacles/Unicorn';

import { BuoySpawner } from './BuoySpawner';
import { IcebergSpawner } from './IcebergSpawner';
import { LogSpawner } from './LogSpawner';
import { MangroveSpawner } from './MangroveSpawner';
import { MessageInABottleSpawner } from './MessageInABottleSpawner';
import { PierSpawner } from './PierSpawner';
import { RockSpawner } from './RockSpawner';
import { WaterGrassSpawner } from './WaterGrassSpawner';
import { LillyPadPatchSpawner } from './LillyPadPatchSpawner';
import { BaseSpawner } from './BaseSpawner';
import { Bluebird } from '../obstacles/Bluebird';
import { Egret } from '../obstacles/Egret';
import { Swan } from '../obstacles/Swan';
import { Decorations, DecorationId } from '../../world/Decorations';

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
    private _lillyPadPatch: LillyPadPatchSpawner = new LillyPadPatchSpawner();

    private attackConfigs: AttackAnimalSpawnConfig[] = [
        {
            id: EntityIds.ALLIGATOR,
            decorationIds: ['alligator'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Alligator(physicsEngine, options),
            shoreProbability: 0.3,
            entityRadius: 5.0,
            heightInWater: Alligator.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.BRONTOSAURUS,
            decorationIds: ['brontosaurus'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Brontosaurus(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: 5.0,
            heightInWater: Brontosaurus.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.TREX,
            decorationIds: ['trex'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new TRex(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: 5.0,
            heightInWater: TRex.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.BROWN_BEAR,
            decorationIds: ['brownBear'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new BrownBear(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 2.5, maxDistFromBank: 3.0 },
            heightInWater: BrownBear.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.POLAR_BEAR,
            decorationIds: ['polarBear'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new PolarBear(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 2.5, maxDistFromBank: 4.0 },
            heightInWater: PolarBear.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.HIPPO,
            decorationIds: ['hippo'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Hippo(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: 5.0,
            heightInWater: Hippo.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.MONKEY,
            decorationIds: ['monkey'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Monkey(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 0.5, maxDistFromBank: 3.0 },
            heightInWater: Monkey.HEIGHT_IN_WATER,
            shoreBehavior: 'walk'
        },
        {
            id: EntityIds.MOOSE,
            decorationIds: ['moose'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Moose(physicsEngine, options),
            shoreProbability: 0.6,
            heightInWater: Moose.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.TRICERATOPS,
            decorationIds: ['triceratops'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Triceratops(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: 5.0,
            heightInWater: Triceratops.HEIGHT_IN_WATER,
            shorePlacement: { minDistFromBank: 3.0, maxDistFromBank: 6.0 },
            waterPlacement: { minDistFromBank: 3.0 }
        },
        {
            id: EntityIds.SNAKE,
            decorationIds: ['snake'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Snake(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: 3.0,
            heightInWater: Snake.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 2.0 }
        },
    ];

    private flyingConfigs: FlyingAnimalSpawnConfig[] = [
        {
            id: EntityIds.BLUEBIRD,
            decorationIds: ['bluebird'],
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Bluebird(physicsEngine, options),
            entityRadius: 1.5
        },
        {
            id: EntityIds.BUTTERFLY,
            decorationIds: ['butterfly'],
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Butterfly(physicsEngine, options),
            entityRadius: 0.5
        },
        {
            id: EntityIds.PTERODACTYL,
            decorationIds: ['pterodactyl'],
            getDensity: () => 0.1 / 20,
            factory: (physicsEngine, options) => new Pterodactyl(physicsEngine, options)
        },
        {
            id: EntityIds.EGRET,
            decorationIds: ['egret'],
            getDensity: () => 0.1 / 20,
            factory: (physicsEngine, options) => new Egret(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: 3.0,
            heightInWater: Egret.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.DRAGONFLY,
            decorationIds: ['dragonfly'],
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Dragonfly(physicsEngine, options),
            entityRadius: 1.5
        }
    ];

    private swimAwayConfigs: SwimAwayAnimalSpawnConfig[] = [
        {
            id: EntityIds.DOLPHIN,
            decorationIds: ['dolphin'],
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new Dolphin(physicsEngine, options),
            heightInWater: Dolphin.HEIGHT_IN_WATER,
            entityRadius: 2.0,
            waterPlacement: { minDistFromBank: 2.0 }
        },
        {
            id: EntityIds.DUCKLING,
            decorationIds: ['duckling'],
            getDensity: () => 0.05,
            factory: (physicsEngine, options) => new Duckling(physicsEngine, options),
            heightInWater: Duckling.HEIGHT_IN_WATER,
            entityRadius: 1.5,
            waterPlacement: { minDistFromBank: 2.0 }
        },
        {
            id: EntityIds.PENGUIN_KAYAK,
            decorationIds: ['penguinKayak'],
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new PenguinKayak(physicsEngine, options),
            heightInWater: PenguinKayak.HEIGHT_IN_WATER,
            entityRadius: 1.5,
            waterPlacement: { minDistFromBank: 1.0 }
        },
        {
            id: EntityIds.SWAN,
            decorationIds: ['swan'],
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new Swan(physicsEngine, options),
            heightInWater: Swan.HEIGHT_IN_WATER,
            entityRadius: 2.0,
            waterPlacement: { minDistFromBank: 1.0 }
        },
        {
            id: EntityIds.TURTLE,
            decorationIds: ['turtle'],
            getDensity: () => 0.02,
            factory: (physicsEngine, options) => new Turtle(physicsEngine, options),
            heightInWater: Turtle.HEIGHT_IN_WATER,
            entityRadius: 1.5,
            shoreProbability: 0.4,
            waterPlacement: { minDistFromBank: 1.0 }
        }
    ];

    private shoreConfigs: ShoreAnimalSpawnConfig[] = [
        {
            id: EntityIds.UNICORN,
            decorationIds: ['unicorn'],
            getDensity: () => 0.05,
            factory: (physicsEngine, options) => new Unicorn(physicsEngine, options),
            entityRadius: 3.0,
            shorePlacement: { minDistFromBank: 4.0, maxDistFromBank: 10.0 }
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

        this.shoreConfigs.forEach(config => {
            this.animalSpawners.set(config.id, new ShoreAnimalSpawner(config));
        });
    }

    public static getInstance(): EntitySpawners {
        if (!EntitySpawners.instance) {
            EntitySpawners.instance = new EntitySpawners();
        }
        return EntitySpawners.instance;
    }

    public *ensureAllLoaded(ids: EntityIds[]): Generator<void | Promise<void>, void, unknown> {
        for (const id of ids) {
            const spawner = this.getSpawnerById(id);
            if (spawner) {
                yield* spawner.ensureLoaded();
            }
        }
    }

    public animal(id: EntityIds): AnimalSpawner | undefined {
        return this.animalSpawners.get(id);
    }

    private getSpawnerById(id: EntityIds): AnimalSpawner | BaseSpawner | undefined {
        if (this.animalSpawners.has(id)) return this.animalSpawners.get(id);
        switch (id) {
            case EntityIds.BUOY: return this._buoy;
            case EntityIds.ICEBERG: return this._iceBerg;
            case EntityIds.LOG: return this._log;
            case EntityIds.MANGROVE: return this._mangrove;
            case EntityIds.BOTTLE: return this._messageInABottle;
            case EntityIds.PIER: return this._pier;
            case EntityIds.ROCK: return this._rock;
            case EntityIds.WATER_GRASS: return this._waterGrass;
            case EntityIds.LILLY_PAD_PATCH: return this._lillyPadPatch;
        }
        return undefined;
    }

    public buoy(): BuoySpawner { return this._buoy; }
    public iceBerg(): IcebergSpawner { return this._iceBerg; }
    public log(): LogSpawner { return this._log; }
    public mangrove(): MangroveSpawner { return this._mangrove; }
    public messageInABottle(): MessageInABottleSpawner { return this._messageInABottle; }
    public pier(): PierSpawner { return this._pier; }
    public rock(): RockSpawner { return this._rock; }
    public waterGrass(): WaterGrassSpawner { return this._waterGrass; }
    public lillyPadPatch(): LillyPadPatchSpawner { return this._lillyPadPatch; }
}
