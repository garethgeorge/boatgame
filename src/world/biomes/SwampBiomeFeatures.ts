import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { EntitySpawners } from '../../entities/EntitySpawners';
import { Decorations } from '../Decorations';
import { BoatPathLayout, BoatPathLayoutStrategy, Patterns } from './decorations/BoatPathLayoutStrategy';
import { RiverGeometry } from '../RiverGeometry';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { AnimalSpawnOptions } from '../../entities/spawners/AnimalSpawner';
import { DecorationRule, TerrainDecorator, DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { SkyBiome } from './BiomeFeatures';

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';
    private static readonly LENGTH = 1600;

    constructor(index: number, z: number, direction: number) {
        super(index, z, SwampBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0x2B / 255, g: 0x24 / 255, b: 0x1C / 255 }; // Muddy Dark Brown
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xB0 / 255, g: 0xA0 / 255, b: 0xD0 / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 300 };
    }


    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x556b2f, bottom: 0xf5f5dc },
            sunset: { top: 0x221100, mid: 0x808000, bottom: 0xbdb76b },
            night: { top: 0x050805, bottom: 0x1e2410 },
            haze: 1.0
        };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.1 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    getRiverWidthMultiplier(): number {
        return 5.0;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        // Behaviors for spawning
        const spawnOptions = (id: EntityIds, inRiver: boolean): AnimalSpawnOptions => {
            if (id !== EntityIds.ALLIGATOR) return {};
            return {
                distanceRange: [-10, 10],
                behavior: {
                    type: 'attack',
                    logicName: 'AmbushAttack'
                }
            };
        };

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: {
                'dense_shore_mangroves': Patterns.scatter({
                    place: 'near-shore',
                    density: [20, 40],
                    types: [EntityIds.MANGROVE],
                    minCount: 15
                }),
                'clear_channel_bottles': Patterns.sequence({
                    place: 'path',
                    density: [0.5, 0.5],
                    types: [EntityIds.BOTTLE]
                }),
                'log_scatter': Patterns.scatter({
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: [EntityIds.LOG]
                }),
                'threat_ambush': Patterns.scatter({
                    place: 'path',
                    density: [0.2, 0.6],
                    types: [EntityIds.ALLIGATOR, EntityIds.SNAKE],
                    options: spawnOptions
                }),
                'egret_flight': Patterns.scatter({
                    place: 'path',
                    density: [1, 2],
                    types: [EntityIds.EGRET]
                }),
                'dragonfly_buzz': Patterns.cluster({
                    place: 'path',
                    density: [0.5, 1],
                    minCount: 2.0,
                    maxCount: 3.0,
                    types: [EntityIds.DRAGONFLY]
                }),
                'grass_patches': Patterns.scatter({
                    place: 'near-shore',
                    density: [1.5, 3.0],
                    types: [EntityIds.WATER_GRASS]
                }),
                'lilly_patches': Patterns.scatter({
                    place: 'middle',
                    density: [5.0, 10.0],
                    minCount: 100,
                    types: [EntityIds.LILLY_PAD_PATCH]
                })
            },
            tracks: [
                {
                    name: 'vegetation',
                    stages: [
                        {
                            name: 'mangroves',
                            progress: [0.0, 1.0],
                            scenes: [
                                { length: [50, 150], patterns: ['dense_shore_mangroves'] }
                            ]
                        }
                    ]
                },
                {
                    name: 'obstacles',
                    stages: [
                        {
                            name: 'standard',
                            progress: [0.0, 1.0],
                            scenes: [
                                { length: [100, 200], patterns: ['log_scatter', 'lilly_patches', 'grass_patches'] },
                                { length: [100, 200], patterns: ['lilly_patches'] }
                            ]
                        }
                    ]
                },
                {
                    name: 'rewards',
                    stages: [
                        {
                            name: 'bottles',
                            progress: [0.0, 1.0],
                            scenes: [
                                { length: [200, 500], patterns: ['clear_channel_bottles'] }
                            ]
                        }
                    ]
                },
                {
                    name: 'threats',
                    stages: [
                        {
                            name: 'threats',
                            progress: [0.2, 1.0],
                            scenes: [
                                { length: [150, 300], patterns: ['threat_ambush'] }
                            ]
                        }
                    ]
                },
                {
                    name: 'friends',
                    stages: [
                        {
                            name: 'friends',
                            progress: [0.0, 1.0],
                            scenes: [
                                { length: [100, 300], patterns: ['egret_flight'] },
                                { length: [100, 300], patterns: ['dragonfly_buzz'] }
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.ALLIGATOR, EntityIds.SNAKE, EntityIds.EGRET, EntityIds.DRAGONFLY],
            path: {
                length: [200, 100]
            }
        });

        return this.layoutCache;
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            const rules: DecorationRule[] = [
                new TierRule({
                    species: [
                        {
                            id: 'mangrove',
                            preference: SpeciesRules.fitness({
                                fitness: 1.0,
                                stepDistance: [5, 55],
                            }),
                            params: SpeciesRules.mangrove()
                        }
                    ]
                }),
            ];
            this.decorationConfig = { rules, maps: {} };
        }
        return this.decorationConfig;
    }


    *decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const decorationConfig = this.getDecorationConfig();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationConfig,
            { xMin: -250, xMax: 250, zMin: zStart, zMax: zEnd },
            spatialGrid,
            42 // Deep Thought
        );
    }

    *spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}

