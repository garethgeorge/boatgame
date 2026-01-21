import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { EntityIds } from '../../entities/EntityIds';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { EntitySpawners } from '../../entities/spawners/EntitySpawners';
import { DecorationRule } from '../decorators/PoissonDecorationStrategy';
import { Combine, Signal, SpeciesHelpers, TierRule } from '../decorators/PoissonDecorationRules';
import { RiverSystem } from '../RiverSystem';
import { RiverGeometry } from '../RiverGeometry';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';

    private decorationRules: DecorationRule[] = [
        new TierRule({
            species: [
                {
                    id: 'willow_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.inRange(Signal.distanceToRiver, 5, 25),
                        Signal.inRange(Signal.elevation, 1.0, 5.0),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 2 * scale,
                            canopyRadius: 8 * scale,
                            spacing: 10 * scale,
                            options: { kind: 'willow', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
                {
                    id: 'oak_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.linearRange(Signal.distanceToRiver, 5, 50),
                        Signal.inRange(Signal.elevation, 3.0, 20.0),
                        Signal.inRange(Signal.slope, 0, 50)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 3 * scale,
                            canopyRadius: 12 * scale,
                            options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                }
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'flower',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.inRange(Signal.distanceToRiver, 5, 25),
                        Signal.inRange(Signal.elevation, 1.0, 5.0),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            groundRadius: 1.0 * scale,
                            options: { kind: 'flower', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
            ]
        })
    ];

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    public getAmplitudeMultiplier(): number {
        return 0.0;
    }

    public createLayout(zMin: number, zMax: number): any {
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        // TerrainDecorator.decorate(
        //     context,
        //     this.decorationRules,
        //     { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
        //     20,
        //     12345 // Fixed seed for now
        // );
    }


    /**
     * This can be used to check the animal models
     */
    private async spawnAllAnimals(context: SpawnContext, z: number): Promise<void> {
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
            EntityIds.DUCKLING,
            EntityIds.PENGUIN_KAYAK,
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
                await spawner.spawnAnimalAbsolute({
                    context,
                    sample,
                    distanceRange: left,
                    aggressiveness: 0.5,
                    disableLogic: true,
                    fixedAngle: 0,
                    fixedHeight: 3.0
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

                await spawner.spawnAnimalAbsolute({
                    context,
                    sample,
                    distanceRange: [-5, 5],
                    aggressiveness: 0.5,
                    disableLogic: true,
                    //fixedAngle: 0,
                    fixedHeight: 3.0
                });
            }
            currentZ -= spacing;
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        // if (zStart === 0) {
        //     await this.spawnAllAnimals(context, -50);
        // }

        // await EntitySpawners.getInstance().messageInABottle().spawn(context, 4, zStart, zEnd);
        await EntitySpawners.getInstance().animal(EntityIds.MONKEY)!.spawn(context, 1, zStart, zEnd);
        // await EntitySpawners.getInstance().animal(EntityIds.ALLIGATOR).spawn(context, 1, zStart, zEnd);
        // await EntitySpawners.getInstance().animal(EntityIds.TRICERATOPS).spawn(context, 1, zStart, zEnd);

        //await EntitySpawners.getInstance().animal(EntityIds.PTERODACTYL).spawn(context, 1, zStart, zEnd);
        //await EntitySpawners.getInstance().animal(EntityIds.BUTTERFLY).spawn(context, 1, zStart, zEnd);
        //await EntitySpawners.getInstance().animal(EntityIds.BLUEBIRD).spawn(context, 1, zStart, zEnd);

        // await EntitySpawners.getInstance().animal(EntityIds.DUCKLING).spawn(context, 1, zStart, zEnd);
        // await EntitySpawners.getInstance().animal(EntityIds.DOLPHIN).spawn(context, 1, zStart, zEnd);
        // await EntitySpawners.getInstance().animal(EntityIds.PENGUIN_KAYAK).spawn(context, 1, zStart, zEnd);
        // await EntitySpawners.getInstance().animal(EntityIds.SWAN).spawn(context, 1, zStart, zEnd);
    }
}
