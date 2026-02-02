import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, TrackConfig } from './decorations/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator, DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { SimplexNoise } from '../SimplexNoise';
import { SkyBiome } from './BiomeFeatures';
import { RiverSystem } from '../RiverSystem';
import { Patterns } from './decorations/BoatPathLayoutPatterns';

/**
 * Fantasy Land Biome: A magical realm with pastel-colored patches and mystical creatures.
 */
export class FantasyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'fantasy';
    private static readonly LENGTH = 1500;

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;
    private groundNoise = new SimplexNoise(12345);

    private readonly COLORS = {
        RIVERBED: new THREE.Color(0xf5f1bb),    // #f5f1bb
        LAVENDER: new THREE.Color(0xc3c3f8),    // #c3c3f8
        MINT: new THREE.Color(0xb0ffd8),        // #b0ffd8
        PINK: new THREE.Color(0xe8abb5),        // #e8abb5
        BLUE: new THREE.Color(0x99d8ed),        // #99d8ed
        LEMON: new THREE.Color(0xfff494),       // #fff494
    };

    constructor(index: number, z: number, direction: number) {
        super(index, z, FantasyBiomeFeatures.LENGTH, direction);
    }

    public override getAmplitudeMultiplier(x: number, z: number, distFromBank: number): number {
        return 0.3 * super.getAmplitudeMultiplier(x, z, distFromBank);
    }

    public override getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {

        const banks = RiverSystem.getInstance().getBankPositions(z);

        let color: THREE.Color;
        if (banks.left <= x && x <= banks.right) {
            color = this.COLORS.RIVERBED; // #f5f1bb
        } else {
            // Use 2D noise for large color patches
            // Large scale for big patches
            const noiseVal = this.groundNoise.noise2D(x * 0.005, z * 0.005);

            if (noiseVal < -0.6) {
                color = this.COLORS.LAVENDER;
            } else if (noiseVal < -0.2) {
                color = this.COLORS.MINT;
            } else if (noiseVal < 0.2) {
                color = this.COLORS.PINK;
            } else if (noiseVal < 0.6) {
                color = this.COLORS.BLUE;
            } else {
                color = this.COLORS.LEMON;
            }
        }

        return { r: color.r, g: color.g, b: color.b };
    }

    public override getScreenTint(): { r: number, g: number, b: number } {
        // Very slight magical purple tint
        return { r: 1.0, g: 0.95, b: 1.0 };
    }

    public override getSkyBiome(): SkyBiome {
        return {
            // #FFC0CB, mid: #bbf8ff, #92faff
            noon: { top: 0xFFC0CB, mid: 0xbbf8ff, bottom: 0x92faff },
            // #4B0082, #EE82EE #FFC0CB
            sunset: { top: 0x4B0082, mid: 0xEE82EE, bottom: 0xFFC0CB }, // Indigo to Violet to Pink
            // #191970 #4B0082
            night: { top: 0x191970, bottom: 0x4B0082 }, // Midnight Blue to Indigo
            haze: 0.3
        };
    }

    private fantasyRules(): DecorationRule[] {
        return [
            new TierRule({
                species: [
                    {
                        id: 'willow_tree',
                        preference: SpeciesRules.fitness({
                            stepDistance: [2, 25], // Near shore
                            slope: [3, 20]
                        }),
                        params: SpeciesRules.willow_tree({
                            spacing: 10,
                            paletteName: 'fantasy_leaves',
                            woodPaletteName: 'fantasy_trunk'
                        })
                    },
                    {
                        id: 'elm_tree',
                        preference: SpeciesRules.fitness({
                            stepDistance: [30, 80], // Further inland
                            slope: [0, 30]
                        }),
                        params: SpeciesRules.elm_tree({
                            size: 4,
                            spacing: 30,
                            paletteName: 'fantasy_leaves',
                            woodPaletteName: 'fantasy_trunk'
                        })
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'daisy',
                        preference: SpeciesRules.fitness({
                            stepDistance: [3, 25], // Along the banks
                            slope: [0, 30],
                            stepNoise: { scale: 100, threshold: 0.6 }
                        }),
                        params: SpeciesRules.daisy({ pack: 0.6, spacing: 0, paletteName: 'daisy' })
                    }
                ]
            })
        ];
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            this.decorationConfig = { rules: this.fantasyRules(), maps: {} };
        }
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const waterAnimals = [EntityIds.SWAN];
        const patterns = {
            'swan_bevies': Patterns.scatter({
                place: 'slalom',
                density: [0.3, 0.6],
                types: [EntityIds.SWAN]
            }),
            'unicorn_herd': Patterns.scatter({
                place: 'on-shore',
                density: [0.2, 0.4],
                types: [EntityIds.UNICORN]
            }),
            'bluebird_flocks': Patterns.scatter({
                place: 'on-shore',
                density: [0.3, 0.5],
                types: [EntityIds.BLUEBIRD]
            }),
            'gingerman_parade': Patterns.scatter({
                place: 'on-shore',
                density: [0.3, 0.6],
                types: [EntityIds.GINGERMAN]
            }),
        };

        const tracks: TrackConfig[] = [
            {
                name: 'river',
                stages: [
                    {
                        name: 'swans',
                        progress: [0.0, 1.0],
                        scenes: [{ length: [100, 300], patterns: ['swan_bevies'] }]
                    }
                ]
            },
            {
                name: 'shore',
                stages: [
                    {
                        name: 'unicorns_and_gingermen',
                        progress: [0.0, 1.0],
                        scenes: [
                            { length: [150, 350], patterns: ['unicorn_herd'] },
                            { length: [150, 350], patterns: ['gingerman_parade'] }
                        ]
                    }
                ]
            },
            {
                name: 'flying',
                stages: [
                    {
                        name: 'bluebirds',
                        progress: [0.0, 1.0],
                        scenes: [{ length: [200, 400], patterns: ['bluebird_flocks'] }]
                    }
                ]
            }
        ];

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: tracks,
            waterAnimals,
            path: {
                length: [200, 100]
            }
        });

        return this.layoutCache;
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const decorationConfig = this.getDecorationConfig();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationConfig,
            { xMin: -250, xMax: 250, zMin: zStart, zMax: zEnd },
            spatialGrid,
            42 // Fixed seed for magical consistency
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const layout = this.getLayout();
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
