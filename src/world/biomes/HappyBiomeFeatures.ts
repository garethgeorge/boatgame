import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, TrackConfig } from './decorations/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator, NoiseMap, DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule, Signal, Combine } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { SkyBiome } from './BiomeFeatures';
import { Patterns } from './decorations/BoatPathLayoutPatterns';


/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Uses Context-Aware Archetypes for procedural placement.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';
    private static readonly LENGTH = 600;

    constructor(index: number, z: number, direction: number) {
        super(index, z, HappyBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x00ccff, bottom: 0xffffff },
            sunset: { top: 0x4b0082, mid: 0xff69b4, bottom: 0xf0e68c },
            night: { top: 0x0a1a33, bottom: 0x334466 },
            haze: 0.4
        };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.5 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    public getDecorationConfig(): DecorationConfig {
        if (this.decorationConfig) return this.decorationConfig;

        const rules: TierRule[] = [];

        {
            const r = Math.random();
            rules.push(new TierRule({
                species: [
                    {
                        id: 'trees',
                        preference: SpeciesRules.fitness({
                            fitness: 0.02,
                            stepDistance: [5, 100]
                        }),
                        params: r < 0.5 ?
                            SpeciesRules.box_elder({ size: 3 }) :
                            SpeciesRules.elm_tree()
                    }
                ]
            }));
        }
        {
            const r = Math.random();
            rules.push(new TierRule({
                species: [
                    {
                        id: 'lilies',
                        preference: SpeciesRules.fitness({
                            fitness: 1,
                            stepDistance: [5, 20],
                            stepNoise: { scale: 50, threshold: 0.7 }
                        }),
                        params: r < 0.5 ?
                            SpeciesRules.lily() :
                            SpeciesRules.daisy()
                    }
                ]
            }));
        }

        this.decorationConfig = { rules: rules, maps: {} };
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const waterAnimals = [];
        const patterns = {
            'dragonfly_swarms': Patterns.scatter({
                place: 'path',
                density: [0.3, 0.6],
                types: [EntityIds.DRAGONFLY]
            }),
        };

        let tracks: TrackConfig[] = [];

        tracks.push({
            name: 'flying',
            stages: [
                {
                    name: 'flying_animals',
                    progress: [0.4, 1.0],
                    scenes: [{ length: [200, 400], patterns: ['dragonfly_swarms'] }]
                }
            ]
        });

        const boatPathLayout = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: tracks,
            waterAnimals,
            path: {
                length: [200, 100]
            }
        });

        this.layoutCache = boatPathLayout;
        return this.layoutCache;
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const decorationConfig = this.getDecorationConfig();
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            decorationConfig,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 // Fixed seed for now
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const layout = this.getLayout();
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
