import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/SpawnContext';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy } from './decorations/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { AnimalSpawnOptions } from '../../entities/spawners/AnimalSpawner';
import { DecorationConfig, DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { SkyBiome } from './BiomeFeatures';
import { Patterns } from './decorations/BoatPathLayoutPatterns';
import { EntityRules } from './decorations/EntityLayoutRules';
import { AnimalEntityRules } from '../../entities/AnimalEntityRules';
import { StaticEntityRules } from '../../entities/StaticEntityRules';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, DesertBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        const c0 = { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
        const c1 = { r: 0xD3 / 255, g: 0x59 / 255, b: 0x24 / 255 };

        // Vary color based on height (elevation bands)
        // Higher ground is darker/redder
        const heightFactor = Math.max(0, Math.min(1, y / 20));
        return {
            r: c0.r + (c1.r - c0.r) * heightFactor,
            g: c0.g + (c1.g - c0.g) * heightFactor,
            b: c0.b + (c1.b - c0.b) * heightFactor,
        };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
    }

    public getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x00aaff, bottom: 0xb0e0ff },
            sunset: { top: 0x1a2b4d, mid: 0xff4500, bottom: 0xffd700 },
            night: { top: 0x02040a, bottom: 0x0a1128 },
            haze: 0.2
        };
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            const rules = [
                new TierRule({
                    species: [
                        {
                            id: 'cactus',
                            preference: SpeciesRules.fitness({
                                fitness: 0.2,
                                stepDistance: [5, 100],
                                slope: [0, 30]
                            }),
                            params: SpeciesRules.cactus()
                        }
                    ]
                }),
                new TierRule({
                    species: [
                        {
                            id: 'rock',
                            preference: SpeciesRules.fitness({
                                fitness: 0.1,
                                stepDistance: [3, 20],
                                slope: [0, 70]
                            }),
                            params: SpeciesRules.rock({ rockBiome: 'desert' })
                        }
                    ]
                })
            ];

            this.decorationConfig = { rules, maps: {} };
        }
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        this.layoutCache = BoatPathLayoutStrategy.createLayout([this.zMin, this.zMax], {
            patterns: {
                'animal_corridor': Patterns.sequence({
                    place: 'near-shore',
                    density: [0.5, 4.0],
                    entity: EntityRules.choose([AnimalEntityRules.alligator(), AnimalEntityRules.monkey()]),
                }),
                'hippo_pod': Patterns.cluster({
                    place: 'near-shore',
                    density: [0.3, 2.0],
                    entity: EntityRules.choose([AnimalEntityRules.hippo()]),
                    minCount: 2,
                }),
                'rocky_slalom': Patterns.sequence({
                    place: 'slalom',
                    density: [0.5, 2.0],
                    entity: EntityRules.choose([StaticEntityRules.rock('desert')])
                }),
                'rock_stagger': Patterns.staggered({
                    place: 'slalom',
                    density: [0.5, 2.0],
                    entity: EntityRules.choose([StaticEntityRules.rock('desert')]),
                    minCount: 3
                }),
                'bottle_cluster': Patterns.cluster({
                    place: 'path',
                    density: [1.5, 0.5],
                    entity: EntityRules.choose([StaticEntityRules.bottle()]),
                    minCount: 3
                })
            },
            tracks: [
                {
                    name: 'main',
                    stages: [
                        {
                            name: 'intro',
                            progress: [0, 0.4],
                            scenes: [
                                { length: [50, 100], patterns: ['rocky_slalom'] },
                                { length: [50, 100], patterns: ['rock_stagger'] }
                            ]
                        },
                        {
                            name: 'gauntlet',
                            progress: [0.3, 0.9],
                            scenes: [
                                { length: [100, 200], patterns: ['animal_corridor', 'rocky_slalom'] },
                                { length: [100, 200], patterns: ['hippo_pod', 'rock_stagger'] }
                            ]
                        }
                    ]
                },
                {
                    name: 'unique_elements',
                    placements: [
                        { name: 'dock', at: 0.95, range: [1, 1], entity: StaticEntityRules.pier(true) }
                    ]
                },
                {
                    name: 'rewards',
                    stages: [
                        {
                            name: 'bottles',
                            progress: [0.0, 0.9],
                            scenes: [
                                { length: [100, 300], patterns: ['bottle_cluster'] }
                            ]
                        }
                    ]
                }
            ],
            path: {
                length: [200, 100]
            }
        });

        return this.layoutCache;
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const config = this.getDecorationConfig();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            config,
            { xMin: -240, xMax: 240, zMin: zStart, zMax: zEnd },
            spatialGrid,
            42 // Desert seed
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }

}
