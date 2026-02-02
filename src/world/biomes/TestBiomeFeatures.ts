import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { EntityIds } from '../../entities/EntityIds';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { EntitySpawners } from '../../entities/EntitySpawners';
import { DecorationRule } from '../decorators/PoissonDecorationStrategy';
import { Combine, Signal, TierRule } from '../decorators/PoissonDecorationRules';
import { RiverSystem } from '../RiverSystem';
import { RiverGeometry } from '../RiverGeometry';
import { DecorationConfig, TerrainDecorator } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, TestBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig = {
        maps: {},
        rules: [
            /*
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
                */
        ]
    };

    public getDecorationConfig(): DecorationConfig {
        return this.decorationConfig;
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.2 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
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

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {

        // if (true && zStart === 0) {
        //     this.spawnAllAnimals(context, -50);
        // }

        const biomeRange: [number, number] = [this.zMin, this.zMax];

        const river = RiverSystem.getInstance();
        const sample = RiverGeometry.getRiverGeometrySample(river, (zStart + zEnd) / 2);
        const distanceRange: [number, number] = [sample.bankDist, sample.bankDist + 10];

        yield* Decorations.ensureAllLoaded(['monkey']);
        EntitySpawners.getInstance().animal(EntityIds.MONKEY).
            spawnOnLand(context, sample, { distanceRange });

        yield* EntitySpawners.getInstance().messageInABottle().spawn(context, 4, zStart, zEnd, biomeRange);
        // yield* EntitySpawners.getInstance().animal(EntityIds.MONKEY)!.spawn(context, 1, zStart, zEnd);
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
