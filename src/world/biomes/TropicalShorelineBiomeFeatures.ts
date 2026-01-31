import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, PatternConfigs, TrackConfig } from './BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator, DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';

/**
 * Tropical Shoreline Biome: A sunny coastal paradise with palm trees and marine life.
 */
export class TropicalShorelineBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'tropical_shoreline';
    private static readonly LENGTH = 1200;

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

    constructor(index: number, z: number, direction: number) {
        super(index, z, TropicalShorelineBiomeFeatures.LENGTH, direction);
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        // Sandy gold color
        return { r: 0xf2 / 255, g: 0xd1 / 255, b: 0x6b / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 1.0, g: 0.98, b: 0.9 };
    }

    protected skyTopColors: number[] = [0x1a2a44, 0xffa500, 0x00bfff]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x0d1522, 0xff4500, 0x87ceeb]; // [Night, Sunset, Noon]

    public override getAmplitudeMultiplier(): number {
        return 0.4; // Relatively flat terrain
    }

    private shorelineRules(): DecorationRule[] {
        return [
            new TierRule({
                species: [
                    {
                        id: 'palm',
                        preference: SpeciesRules.fitness({
                            stepDistance: [2, 40],
                            slope: [0, 20]
                        }),
                        params: SpeciesRules.palm_tree()
                    }
                ]
            }),
            new TierRule({
                species: [
                    {
                        id: 'rock',
                        preference: SpeciesRules.fitness({
                            stepDistance: [0, 15],
                            slope: [10, 60],
                            fitness: 0.5
                        }),
                        params: SpeciesRules.rock()
                    }
                ]
            })
        ];
    }

    public getDecorationConfig(): DecorationConfig {
        if (!this.decorationConfig) {
            this.decorationConfig = { rules: this.shorelineRules(), maps: {} };
        }
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const waterAnimals = [EntityIds.DOLPHIN];
        const patterns: PatternConfigs = {
            'dolphin_pods': {
                logic: 'scatter',
                place: 'slalom',
                density: [0.4, 0.7],
                types: [EntityIds.DOLPHIN]
            },
            'turtle_beaches': {
                logic: 'scatter',
                place: 'near-shore',
                density: [0.3, 0.6],
                types: [EntityIds.TURTLE]
            }
        };

        const riverTrack: TrackConfig = {
            name: 'river',
            stages: [
                {
                    name: 'dolphins',
                    progress: [0.0, 1.0],
                    patterns: [[{ pattern: 'dolphin_pods', weight: 1.0 }]]
                }
            ]
        };

        const shoreTrack: TrackConfig = {
            name: 'near-shore',
            stages: [
                {
                    name: 'turtles',
                    progress: [0.0, 1.0],
                    patterns: [[{ pattern: 'turtle_beaches', weight: 1.0 }]]
                }
            ]
        };

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: [riverTrack, shoreTrack],
            waterAnimals
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
            Date.now()
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const layout = this.getLayout();
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
