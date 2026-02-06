import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { BoatPathLayout, BoatPathLayoutStrategy, TrackConfig } from '../layout/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from '../layout/BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator, NoiseMap, DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule, Signal, Combine } from '../decorators/PoissonDecorationRules';
import { DecoRules } from '../decorations/DecoRules';
import { SkyBiome } from './BiomeFeatures';
import { Placements, Patterns } from '../layout/BoatPathLayoutPatterns';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { EntityRules } from '../layout/EntityLayoutRules';
import { DragonflyRule } from '../../entities/AnimalEntityRules';
import { SpatialGrid, SpatialGridPair } from '../../core/SpatialGrid';


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

    private spatialGrid: SpatialGrid = new SpatialGrid(20);
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
                        preference: DecoRules.fitness({
                            fitness: 0.02,
                            stepDistance: [5, 100]
                        }),
                        params: r < 0.5 ?
                            DecoRules.box_elder({ size: 3 }) :
                            DecoRules.elm_tree()
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
                        preference: DecoRules.fitness({
                            fitness: 1,
                            stepDistance: [5, 20],
                            stepNoise: { scale: 50, threshold: 0.7 }
                        }),
                        params: r < 0.5 ?
                            DecoRules.lily() :
                            DecoRules.daisy()
                    }
                ]
            }));
        }

        this.decorationConfig = { rules: rules, maps: {} };
        return this.decorationConfig;
    }

    private getLayout(): BoatPathLayout {
        if (this.layoutCache) return this.layoutCache;

        const tracks: TrackConfig[] = [{
            name: 'flying',
            stages: [{
                name: 'flying_animals',
                progress: [0.4, 1.0],
                scenes: [{ length: [200, 400], patterns: [Place.scatter_path(DragonflyRule.get(), [0.3, 0.6])] }]
            }]
        }];

        this.layoutCache = BoatPathLayoutStrategy.createLayout([this.zMin, this.zMax], {
            tracks,
            path: {
                length: [200, 100]
            }
        }, this.spatialGrid);

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
