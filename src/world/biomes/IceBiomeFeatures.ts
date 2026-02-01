import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations } from '../Decorations';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule, Combine, Signal } from '../decorators/PoissonDecorationRules';
import { EntityIds } from '../../entities/EntityIds';
import { EntitySpawners } from '../../entities/spawners/EntitySpawners';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { SkyBiome } from './BiomeFeatures';

export class IceBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'ice';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, IceBiomeFeatures.LENGTH, direction);
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 };
    }
    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 400 };
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0xa0c0f0, bottom: 0xe0f0ff },
            sunset: { top: 0x203050, mid: 0x9370db, bottom: 0xffb6c1 },
            night: { top: 0x010510, bottom: 0x102040 },
            haze: 0.1
        };
    }

    getRiverWidthMultiplier(): number {
        return 2.3;
    }

    private decorationConfig: DecorationConfig | null = null;

    public getDecorationConfig(): DecorationConfig {
        if (this.decorationConfig) return this.decorationConfig;

        const rules = [
            new TierRule({
                species: [
                    {
                        id: 'oak_tree',
                        preference: SpeciesRules.fitness({
                            fitness: 0.6,
                            stepDistance: [10, 200],
                            slope: [0, 30]
                        }),
                        params: SpeciesRules.oak_tree({ snow: true, leaves: 0.5 })
                    },
                    {
                        id: 'elm_tree',
                        preference: SpeciesRules.fitness({
                            fitness: 0.4,
                            stepDistance: [10, 60],
                            slope: [0, 25]
                        }),
                        params: SpeciesRules.elm_tree()
                    },
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: SpeciesRules.fitness({
                            fitness: 0.1
                        }),
                        params: SpeciesRules.rock({ rockBiome: 'ice' })
                    },
                ]
            })
        ];

        this.decorationConfig = { rules, maps: {} };
        return this.decorationConfig;
    }

    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const config = this.getDecorationConfig();
        yield* TerrainDecorator.decorateIterator(
            context,
            config,
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
