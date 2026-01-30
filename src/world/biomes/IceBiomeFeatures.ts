import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations } from '../Decorations';
import { DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule, Combine, Signal } from '../decorators/PoissonDecorationRules';
import { EntityIds } from '../../entities/EntityIds';
import { EntitySpawners } from '../../entities/spawners/EntitySpawners';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';

export class IceBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'ice';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, IceBiomeFeatures.LENGTH, direction);
    }

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 400 };
    }

    protected skyTopColors: number[] = [0x0c1424, 0x888b8f, 0xc2c7da]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x20283d, 0x85a2bd, 0xe5d9b2]; // [Night, Sunset, Noon]

    getRiverWidthMultiplier(): number {
        return 2.3;
    }

    private decorationRules: DecorationRule[] | null = null;

    private getDecorationRules(): DecorationRule[] {
        if (this.decorationRules) return this.decorationRules;

        this.decorationRules = [
            new TierRule({
                species: [
                    SpeciesRules.oak_tree({
                        fitness: 0.6,
                        stepDistance: [10, 200],
                        slope: [0, 30],
                        snow: true,
                        leaves: 0.5
                    }),
                    SpeciesRules.elm_tree({
                        fitness: 0.4,
                        stepDistance: [10, 60],
                        slope: [0, 25]
                    }),
                ]
            }),
            new TierRule({
                species: [
                    SpeciesRules.rock({
                        fitness: 0.1,
                        rockBiome: 'ice'
                    }),
                ]
            })
        ];
        return this.decorationRules;
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const rules = this.getDecorationRules();
        yield* TerrainDecorator.decorateIterator(
            context,
            rules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            context.chunk.spatialGrid,
            this.index
        );
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // Gatekeeping for spawner assets
        yield* EntitySpawners.getInstance().ensureAllLoaded([
            EntityIds.BUOY, EntityIds.BOTTLE, EntityIds.ICEBERG,
            EntityIds.PENGUIN_KAYAK, EntityIds.POLAR_BEAR
        ]);

        yield* this.spawnObstacles(EntitySpawners.getInstance().buoy(), context, difficulty, zStart, zEnd);
        yield* this.spawnObstacles(EntitySpawners.getInstance().messageInABottle(), context, difficulty, zStart, zEnd);

        yield* this.spawnObstacles(EntitySpawners.getInstance().iceBerg(), context, difficulty, zStart, zEnd);
        yield* this.spawnObstacles(EntitySpawners.getInstance().animal(EntityIds.PENGUIN_KAYAK)!, context, difficulty, zStart, zEnd);
        yield* this.spawnObstacles(EntitySpawners.getInstance().animal(EntityIds.POLAR_BEAR)!, context, difficulty, zStart, zEnd);
    }
}
