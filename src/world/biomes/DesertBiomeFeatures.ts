import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations } from '../Decorations';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { AnimalSpawnOptions } from '../../entities/spawners/AnimalSpawner';
import { DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';

export class DesertBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'desert';
    private static readonly LENGTH = 2000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, DesertBiomeFeatures.LENGTH, direction);
    }

    private decorationRules: DecorationRule[] | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0xCC / 255, g: 0x88 / 255, b: 0x22 / 255 };
    }

    protected skyTopColors: number[] = [0x04193c, 0x05559c, 0x058fea]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x024b82, 0xafd9ae, 0x53baf5]; // [Night, Sunset, Noon]

    public getDecorationRules(): DecorationRule[] {
        if (!this.decorationRules) {
            this.decorationRules = [
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
        }
        return this.decorationRules;
    }

    public setDecorationRules(rules: DecorationRule[]): void {
        this.decorationRules = rules;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        // Behaviors for spawning
        const spawnOptions = (id: EntityIds, inRiver: boolean): AnimalSpawnOptions => {
            if (!inRiver) {
                return {
                    behavior: {
                        type: id === EntityIds.MONKEY ? 'walk-attack' : 'wait-attack',
                        logicName: Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack'
                    }
                };
            } else {
                return {
                    behavior: {
                        type: 'attack',
                        logicName: Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack'
                    }
                }
            }
        };

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: {
                'animal_corridor': {
                    logic: 'sequence',
                    place: 'near-shore',
                    density: [0.5, 4.0],
                    types: [EntityIds.ALLIGATOR, EntityIds.MONKEY],
                    options: spawnOptions
                },
                'hippo_pod': {
                    logic: 'cluster',
                    place: 'near-shore',
                    density: [0.3, 2.0],
                    types: [EntityIds.HIPPO],
                    minCount: 2,
                    options: spawnOptions
                },
                'rocky_slalom': {
                    logic: 'sequence',
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: [EntityIds.ROCK]
                },
                'rock_stagger': {
                    logic: 'staggered',
                    place: 'slalom',
                    density: [0.5, 2.0],
                    types: [EntityIds.ROCK],
                    minCount: 3
                },
                'bottle_cluster': {
                    logic: 'cluster',
                    place: 'path',
                    density: [1.5, 0.5],
                    types: [EntityIds.BOTTLE],
                    minCount: 3
                }
            },
            tracks: [
                {
                    name: 'main',
                    stages: [
                        {
                            name: 'intro',
                            progress: [0, 0.4],
                            patterns: [
                                [
                                    { pattern: 'rocky_slalom', weight: 1 },
                                    { pattern: 'rock_stagger', weight: 1 }
                                ]
                            ]
                        },
                        {
                            name: 'gauntlet',
                            progress: [0.3, 0.9],
                            patterns: [
                                [
                                    { pattern: 'animal_corridor', weight: 2 },
                                    { pattern: 'hippo_pod', weight: 1 }
                                ],
                                [
                                    { pattern: 'rocky_slalom', weight: 1 },
                                    { pattern: 'rock_stagger', weight: 1 }
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'unique_elements',
                    placements: [
                        { name: 'dock', place: 'near-shore', at: 0.95, type: EntityIds.PIER }
                    ]
                },
                {
                    name: 'rewards',
                    stages: [
                        {
                            name: 'bottles',
                            progress: [0.0, 0.9],
                            patterns: [
                                [
                                    { pattern: 'bottle_cluster', weight: 1 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: [EntityIds.HIPPO]
        });

        return this.layoutCache;
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const rules = this.getDecorationRules();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            rules,
            { xMin: -240, xMax: 240, zMin: zStart, zMax: zEnd },
            spatialGrid,
            42 // Desert seed
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(context, this.getLayout(), this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }

}
