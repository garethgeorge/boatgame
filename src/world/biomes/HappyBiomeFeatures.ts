import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, PatternConfigs, TrackConfig } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator } from '../decorators/TerrainDecorator';
import { RIVERLAND_DECORATION_RULES } from './decorations/RiverlandDecorationRules';
import { PARKLAND_DECORATION_RULES } from './decorations/ParklandDecorationRules';


/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Uses Context-Aware Archetypes for procedural placement.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, HappyBiomeFeatures.LENGTH, direction);
    }

    private decorationRules: DecorationRule[] | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    protected skyTopColors: number[] = [0x303948, 0xf6b581, 0x01cad1]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x5b6831, 0xf7efbc, 0xb0ece6]; // [Night, Sunset, Noon]

    public override getAmplitudeMultiplier(): number {
        return 0.5;
    }

    private getDecorationRules(): DecorationRule[] {
        if (!this.decorationRules) {
            this.decorationRules = Math.random() < 0.5 ?
                RIVERLAND_DECORATION_RULES : PARKLAND_DECORATION_RULES;
        }
        return this.decorationRules;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const waterAnimals = [EntityIds.DOLPHIN, EntityIds.SWAN];
        const patterns: PatternConfigs = {
            'dolphin_pods': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.5, 1.0],
                types: [EntityIds.DOLPHIN]
            },
            'swan_bevies': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.5, 1.0],
                types: [EntityIds.SWAN]
            },
            'turtle_hurds': {
                logic: 'scatter',
                place: 'shore',
                density: [0.5, 1.0],
                types: [EntityIds.TURTLE]
            },
            'butterfly_swarms': {
                logic: 'scatter',
                place: 'shore',
                density: [0.8, 1.2],
                types: [EntityIds.BUTTERFLY]
            },
            'bluebird_flocks': {
                logic: 'scatter',
                place: 'shore',
                density: [0.8, 1.2],
                types: [EntityIds.BLUEBIRD]
            },
            'dragonfly_swarms': {
                logic: 'scatter',
                place: 'path',
                density: [0.8, 1.2],
                types: [EntityIds.DRAGONFLY]
            }
        };

        // Pick a combination by simple cycling through
        const patternCombos = [
            { river: 'dolphin_pods', flying: 'bluebird_flocks' },
            { river: 'swan_bevies', flying: 'butterfly_swarms' },
            { river: 'turtle_hurds', flying: 'dragonfly_swarms' },
        ];
        const combo = patternCombos[Math.abs(this.index) % 3];

        const riverTrack: TrackConfig = {
            name: 'river',
            stages: [
                {
                    name: 'river_animals',
                    progress: [0.2, 1.0],
                    patterns: [[{ pattern: combo.river, weight: 1.0 }]]
                }
            ]
        };

        const flyingTrack: TrackConfig = {
            name: 'flying',
            stages: [
                {
                    name: 'flying_animals',
                    progress: [0.4, 1.0],
                    patterns: [
                        [
                            { pattern: combo.flying, weight: 1.0 }
                        ]
                    ]
                }
            ]
        };

        const boatPathLayout = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: [
                riverTrack, flyingTrack
            ],
            waterAnimals
        });

        this.layoutCache = boatPathLayout;
        return this.layoutCache;
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void, void, unknown> {
        const decorationRules = this.getDecorationRules();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationRules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 // Fixed seed for now
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void, void, unknown> {
        const layout = this.getLayout();
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd);
    }
}
