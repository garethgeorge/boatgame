import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { BiomeType } from './BiomeType';
import { PopulationContext } from './PopulationContext';
import { Decorations } from '../Decorations';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule, Combine, Signal } from '../decorators/PoissonDecorationRules';
import { EntityIds } from '../../entities/EntityIds';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { SkyBiome } from './BiomeFeatures';
import { Placements, Patterns } from './decorations/BoatPathLayoutPatterns';
import { EntityRules } from './decorations/EntityLayoutRules';
import { PolarBearRule, PenguinKayakRule } from '../../entities/AnimalEntityRules';
import { IcebergRule, BuoyRule, BottleRule } from '../../entities/StaticEntityRules';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { BoatPathLayout, BoatPathLayoutStrategy, TrackConfig } from './decorations/BoatPathLayoutStrategy';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';

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

    private spatialGrid: SpatialGrid = new SpatialGrid(20);
    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

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

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const iceberg_scatter = Patterns.scatter({
            placement: Placements.slalom({
                entity: EntityRules.choose([IcebergRule.get()])
            }),
            density: [1.0, 3.0],
        });
        const buoys = Patterns.scatter({
            placement: Placements.middle({
                entity: EntityRules.choose([BuoyRule.get()])
            }),
            density: [0.5, 1.5],
        });
        const bottle_hunt = Patterns.scatter({
            placement: Placements.path({
                entity: EntityRules.choose([BottleRule.get()])
            }),
            density: [0.25, 0.25],
        });
        const animals = Patterns.scatter({
            placement: Placements.nearShore({
                entity: EntityRules.choose([PolarBearRule.get(), PenguinKayakRule.get()])
            }),
            density: [0.5, 0.5],
        });

        const tracks: TrackConfig[] = [
            {
                name: 'rewards',
                stages: [
                    {
                        name: 'bottles', progress: [0, 1.0],
                        scenes: [{ length: [100, 200], patterns: [bottle_hunt] }]
                    }
                ]
            },
            {
                name: 'obstacles',
                stages: [
                    {
                        name: 'buoys', progress: [0, 1.0],
                        scenes: [{ length: [100, 200], patterns: [buoys] }]
                    }
                ]
            },
            {
                name: 'animals',
                stages: [
                    {
                        name: 'animals', progress: [0, 1.0],
                        scenes: [{ length: [100, 200], patterns: [animals] }]
                    }
                ]
            },
            {
                name: 'bergs',
                stages: [
                    {
                        name: 'icebergs', progress: [0, 1.0],
                        scenes: [{ length: [100, 200], patterns: [iceberg_scatter] }]
                    }
                ]
            }
        ];

        const boatPathLayout = BoatPathLayoutStrategy.createLayout([this.zMin, this.zMax], {
            tracks: tracks,
            path: {
                length: [200, 100]
            }
        }, this.spatialGrid);

        this.layoutCache = boatPathLayout;
        return this.layoutCache;
    }

    * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // 1. Get entity layout creating it if needed
        const layout = this.getLayout();

        // 2. Decorate
        const decorationConfig = this.getDecorationConfig();

        // decorations are inserted into the chunk grid but checked for
        // collisions against the layout grid for the entire biome
        const spatialGrid = new SpatialGridPair(
            context.chunk.spatialGrid,
            this.spatialGrid
        );

        yield* TerrainDecorator.decorateIterator(
            context,
            decorationConfig,
            { xMin: -250, xMax: 250, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 + zStart // Seed variation
        );

        // 3. Spawn
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
