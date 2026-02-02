import { AnimalSpawner, AnimalSpawnerConfig } from './spawners/AnimalSpawner';
import { EntityIds } from './EntityIds';
import { Alligator } from './obstacles/Alligator';
import { Snake } from './obstacles/Snake';
import { Brontosaurus } from './obstacles/Brontosaurus';
import { TRex } from './obstacles/TRex';
import { BrownBear } from './obstacles/BrownBear';
import { PolarBear } from './obstacles/PolarBear';
import { Hippo } from './obstacles/Hippo';
import { Monkey } from './obstacles/Monkey';
import { Moose } from './obstacles/Moose';
import { Triceratops } from './obstacles/Triceratops';
import { Dolphin } from './obstacles/Dolphin';
import { Duckling } from './obstacles/Duckling';
import { PenguinKayak } from './obstacles/PenguinKayak';
import { Butterfly } from './obstacles/Butterfly';
import { Pterodactyl } from './obstacles/Pterodactyl';
import { Dragonfly } from './obstacles/Dragonfly';
import { Turtle } from './obstacles/Turtle';
import { Unicorn } from './obstacles/Unicorn';
import { BuoySpawner } from './spawners/BuoySpawner';
import { IcebergSpawner } from './spawners/IcebergSpawner';
import { LogSpawner } from './spawners/LogSpawner';
import { MangroveSpawner } from './spawners/MangroveSpawner';
import { MessageInABottleSpawner } from './spawners/MessageInABottleSpawner';
import { PierSpawner } from './spawners/PierSpawner';
import { RockSpawner } from './spawners/RockSpawner';
import { WaterGrassSpawner } from './spawners/WaterGrassSpawner';
import { LillyPadPatchSpawner } from './spawners/LillyPadPatchSpawner';
import { BaseSpawner } from './spawners/BaseSpawner';
import { Bluebird } from './obstacles/Bluebird';
import { Egret } from './obstacles/Egret';
import { Swan } from './obstacles/Swan';
import { GingerMan } from './obstacles/GingerMan';

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

    private animalConfigs: AnimalSpawnerConfig[] = [
        // Attack Animals
        {
            id: EntityIds.ALLIGATOR,
            decorationIds: ['alligator'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Alligator(physicsEngine, options),
            shoreProbability: 0.3,
            entityRadius: Alligator.RADIUS,
            heightInWater: Alligator.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 },
            defaultShoreBehavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.BRONTOSAURUS,
            decorationIds: ['brontosaurus'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Brontosaurus(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: Brontosaurus.RADIUS,
            heightInWater: Brontosaurus.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 },
            defaultShoreBehavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.TREX,
            decorationIds: ['trex'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new TRex(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: TRex.RADIUS,
            heightInWater: TRex.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 },
            defaultShoreBehavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.BROWN_BEAR,
            decorationIds: ['brownBear'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new BrownBear(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 2.5, maxDistFromBank: 3.0 },
            entityRadius: BrownBear.RADIUS,
            heightInWater: BrownBear.HEIGHT_IN_WATER,
            defaultShoreBehavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.POLAR_BEAR,
            decorationIds: ['polarBear'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new PolarBear(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 2.5, maxDistFromBank: 4.0 },
            entityRadius: PolarBear.RADIUS,
            heightInWater: PolarBear.HEIGHT_IN_WATER,
            defaultShoreBehavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.HIPPO,
            decorationIds: ['hippo'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Hippo(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: Hippo.RADIUS,
            heightInWater: Hippo.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 3.0 },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.MONKEY,
            decorationIds: ['monkey'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Monkey(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 0.5, maxDistFromBank: 3.0 },
            entityRadius: Monkey.RADIUS,
            heightInWater: Monkey.HEIGHT_IN_WATER,
            defaultShoreBehavior: { type: 'walk-attack', logicName: 'AmbushAttack' },
        },
        {
            id: EntityIds.GINGERMAN,
            decorationIds: ['gingerman'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new GingerMan(physicsEngine, options),
            shoreProbability: 1.0,
            shorePlacement: { minDistFromBank: 0.5, maxDistFromBank: 3.0 },
            entityRadius: GingerMan.RADIUS,
            heightInWater: GingerMan.HEIGHT_IN_WATER,
            defaultShoreBehavior: { type: 'walk-attack', logicName: 'WolfAttack' },
        },
        {
            id: EntityIds.MOOSE,
            decorationIds: ['moose'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Moose(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: Moose.RADIUS,
            heightInWater: Moose.HEIGHT_IN_WATER,
            defaultShoreBehavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.TRICERATOPS,
            decorationIds: ['triceratops'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Triceratops(physicsEngine, options),
            shoreProbability: 0.6,
            entityRadius: Triceratops.RADIUS,
            heightInWater: Triceratops.HEIGHT_IN_WATER,
            shorePlacement: { minDistFromBank: 3.0, maxDistFromBank: 6.0 },
            waterPlacement: { minDistFromBank: 3.0 },
            defaultShoreBehavior: { type: 'wait-attack', logicName: 'WolfAttack' },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },
        {
            id: EntityIds.SNAKE,
            decorationIds: ['snake'],
            getDensity: () => 0.1 / 15,
            factory: (physicsEngine, options) => new Snake(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: Snake.RADIUS,
            heightInWater: Snake.HEIGHT_IN_WATER,
            waterPlacement: { minDistFromBank: 2.0 },
            defaultWaterBehavior: { type: 'attack', logicName: 'WolfAttack' }
        },

        // Flying Animals
        {
            id: EntityIds.BLUEBIRD,
            decorationIds: ['bluebird'],
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Bluebird(physicsEngine, options),
            entityRadius: Bluebird.RADIUS
        },
        {
            id: EntityIds.BUTTERFLY,
            decorationIds: ['butterfly'],
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Butterfly(physicsEngine, options),
            entityRadius: Butterfly.RADIUS
        },
        {
            id: EntityIds.PTERODACTYL,
            decorationIds: ['pterodactyl'],
            getDensity: () => 0.1 / 20,
            factory: (physicsEngine, options) => new Pterodactyl(physicsEngine, options),
            entityRadius: Pterodactyl.RADIUS
        },
        {
            id: EntityIds.EGRET,
            decorationIds: ['egret'],
            getDensity: () => 0.1 / 20,
            factory: (physicsEngine, options) => new Egret(physicsEngine, options),
            shoreProbability: 0.0,
            entityRadius: Egret.RADIUS,
            heightInWater: Egret.HEIGHT_IN_WATER
        },
        {
            id: EntityIds.DRAGONFLY,
            decorationIds: ['dragonfly'],
            getDensity: () => 0.5 / 20,
            factory: (physicsEngine, options) => new Dragonfly(physicsEngine, options),
            entityRadius: Dragonfly.RADIUS
        },

        // Swim Away Animals
        {
            id: EntityIds.DOLPHIN,
            decorationIds: ['dolphin'],
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new Dolphin(physicsEngine, options),
            heightInWater: Dolphin.HEIGHT_IN_WATER,
            entityRadius: Dolphin.RADIUS,
            waterPlacement: { minDistFromBank: 2.0 },
            defaultWaterBehavior: { type: 'swim' }
        },
        {
            id: EntityIds.DUCKLING,
            decorationIds: ['duckling'],
            getDensity: () => 0.05,
            factory: (physicsEngine, options) => new Duckling(physicsEngine, options),
            heightInWater: Duckling.HEIGHT_IN_WATER,
            entityRadius: Duckling.RADIUS,
            waterPlacement: { minDistFromBank: 2.0 },
            defaultWaterBehavior: { type: 'swim' }
        },
        {
            id: EntityIds.PENGUIN_KAYAK,
            decorationIds: ['penguinKayak'],
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new PenguinKayak(physicsEngine, options),
            heightInWater: PenguinKayak.HEIGHT_IN_WATER,
            entityRadius: PenguinKayak.RADIUS,
            waterPlacement: { minDistFromBank: 1.0 },
            defaultWaterBehavior: { type: 'swim' }
        },
        {
            id: EntityIds.SWAN,
            decorationIds: ['swan'],
            getDensity: () => 0.01,
            factory: (physicsEngine, options) => new Swan(physicsEngine, options),
            heightInWater: Swan.HEIGHT_IN_WATER,
            entityRadius: Swan.RADIUS,
            waterPlacement: { minDistFromBank: 1.0 },
            defaultWaterBehavior: { type: 'swim' }
        },
        {
            id: EntityIds.TURTLE,
            decorationIds: ['turtle'],
            getDensity: () => 0.02,
            factory: (physicsEngine, options) => new Turtle(physicsEngine, options),
            heightInWater: Turtle.HEIGHT_IN_WATER,
            entityRadius: Turtle.RADIUS,
            shoreProbability: 0.4,
            waterPlacement: { minDistFromBank: 1.0 },
            defaultShoreBehavior: { type: 'wait-swim' },
            defaultWaterBehavior: { type: 'swim' }
        },

        // Shore Animals
        {
            id: EntityIds.UNICORN,
            decorationIds: ['unicorn'],
            getDensity: () => 0.05,
            factory: (physicsEngine, options) => new Unicorn(physicsEngine, options),
            entityRadius: Unicorn.RADIUS,
            shorePlacement: { minDistFromBank: 4.0, maxDistFromBank: 10.0 },
            defaultShoreBehavior: { type: 'unicorn' }
        }
    ];

    private constructor() {
        // Create Animal Spawners
        this.animalConfigs.forEach(config => {
            this.animalSpawners.set(config.id, new AnimalSpawner(config));
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

