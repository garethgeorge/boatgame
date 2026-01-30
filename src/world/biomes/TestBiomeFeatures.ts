import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { EntityIds } from '../../entities/EntityIds';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { EntitySpawners } from '../../entities/spawners/EntitySpawners';
import { DecorationRule } from '../decorators/PoissonDecorationStrategy';
import { Combine, Signal, TierRule } from '../decorators/PoissonDecorationRules';
import { RiverSystem } from '../RiverSystem';
import { RiverGeometry } from '../RiverGeometry';
import { DecorationConfig, TerrainDecorator } from '../decorators/TerrainDecorator';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, TestBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig = {
        maps: {},
        rules: [
            new TierRule({
                species: [
                    {
                        id: 'land',
                        preference: Combine.all(
                            Signal.constant(1.0),
                            Signal.inRange(Signal.distanceToRiver, 5, 25),
                        ),
                        params: (ctx) => {
                            const scale = 0.8 + ctx.random() * 0.4;
                            const kinds = ['daisy', 'lily', 'waterlily'];
                            const kind = kinds[Math.floor(Math.random() * 3)];
                            return {
                                groundRadius: 0.5 * scale,
                                options: {
                                    kind: kind,
                                    rotation: ctx.random() * Math.PI * 2,
                                    scale
                                },
                                spacing: 4.0
                            };
                        }
                    },
                ]
            })
        ]
    };

    public getDecorationConfig(): DecorationConfig {
        return this.decorationConfig;
    }

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    public getAmplitudeMultiplier(): number {
        return 0.0;
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            this.decorationConfig,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 // Fixed seed for now
        );
    }


    /**
     * This can be used to check the animal models
     */
    private spawnAllAnimals(context: SpawnContext, z: number) {
        const animalIds = [
            EntityIds.ALLIGATOR,
            EntityIds.BRONTOSAURUS,
            EntityIds.TREX,
            EntityIds.BROWN_BEAR,
            EntityIds.POLAR_BEAR,
            EntityIds.HIPPO,
            EntityIds.MONKEY,
            EntityIds.MOOSE,
            EntityIds.TRICERATOPS,
            EntityIds.BUTTERFLY,
            EntityIds.PTERODACTYL,
            EntityIds.BLUEBIRD,
        ];
        const waterIds = [
            EntityIds.DOLPHIN,
            EntityIds.DRAGONFLY,
            EntityIds.DUCKLING,
            EntityIds.EGRET,
            EntityIds.PENGUIN_KAYAK,
            EntityIds.SNAKE,
            EntityIds.SWAN
        ];

        let currentZ = z;
        const spacing = 15;
        const xOffset = 15; // Offset from river bank

        for (const id of animalIds) {
            const spawner = EntitySpawners.getInstance().animal(id);
            if (spawner) {
                // We use fixed sample to place them in a line
                const riverSystem = RiverSystem.getInstance();
                const sample = RiverGeometry.getRiverGeometrySample(riverSystem, currentZ);

                // Place on bank
                const right: [number, number] = [sample.bankDist + xOffset, sample.bankDist + xOffset + 5];
                const left: [number, number] = [-sample.bankDist - xOffset - 5, -sample.bankDist - xOffset];
                spawner.spawnOnLand(context, sample, {
                    distanceRange: left,
                    aggressiveness: 0.5,
                    disableLogic: true,
                    fixedAngle: 0,
                    fixedHeight: 3.0,
                    biomeZRange: [this.zMin, this.zMax]
                });
            }
            currentZ -= spacing;
        }
        for (const id of waterIds) {
            const spawner = EntitySpawners.getInstance().animal(id);
            if (spawner) {
                // We use fixed sample to place them in a line
                const riverSystem = RiverSystem.getInstance();
                const sample = RiverGeometry.getRiverGeometrySample(riverSystem, currentZ);

                spawner.spawnInRiver(context, sample, {
                    distanceRange: [-5, 5],
                    aggressiveness: 0.5,
                    disableLogic: true,
                    fixedAngle: 0,
                    fixedHeight: 3.0,
                    biomeZRange: [this.zMin, this.zMax]
                });
            }
            currentZ -= spacing;
        }
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // if (true && zStart === 0) {
        //     this.spawnAllAnimals(context, -50);
        // }

        // yield* EntitySpawners.getInstance().messageInABottle().spawn(context, 4, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.MONKEY)!.spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.ALLIGATOR).spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.TRICERATOPS).spawn(context, 1, zStart, zEnd);

        // yield* EntitySpawners.getInstance().animal(EntityIds.PTERODACTYL).spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.BUTTERFLY).spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.BLUEBIRD).spawn(context, 1, zStart, zEnd);

        // yield* EntitySpawners.getInstance().animal(EntityIds.DUCKLING).spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.DOLPHIN).spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.PENGUIN_KAYAK).spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.SWAN).spawn(context, 1, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.EGRET).spawn(context, 2, zStart, zEnd);
        // yield* EntitySpawners.getInstance().animal(EntityIds.DRAGONFLY).spawn(context, 1, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
