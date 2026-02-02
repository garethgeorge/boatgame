import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy, Patterns, TrackConfig } from './decorations/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { BoatPathLayoutSpawner } from './decorations/BoatPathLayoutSpawner';
import { DecorationRule, TerrainDecorator, DecorationConfig } from '../decorators/TerrainDecorator';
import { TierRule } from '../decorators/PoissonDecorationRules';
import { SpeciesRules } from './decorations/SpeciesDecorationRules';
import { RiverSystem } from '../RiverSystem';
import { SimplexNoise } from '../SimplexNoise';
import { MathUtils } from '../../core/MathUtils';
import { SkyBiome } from './BiomeFeatures';

/**
 * Tropical Shoreline Biome: A sunny coastal paradise with palm trees and marine life.
 */
export class TropicalShorelineBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'tropical_shoreline';
    private static readonly LENGTH = 1200;

    private decorationConfig: DecorationConfig | null = null;
    private layoutCache: BoatPathLayout | null = null;
    private colorNoise = new SimplexNoise(42);
    private readonly SAND_COLOR = new THREE.Color(0xf2d16b);
    private readonly GRASS_COLOR = new THREE.Color(0x33aa33);

    constructor(index: number, z: number, direction: number) {
        super(index, z, TropicalShorelineBiomeFeatures.LENGTH, direction);
    }

    public override getSkyBiome(): SkyBiome {
        return {
            noon: { top: 0x00bfff, bottom: 0x7fffd4 },
            sunset: { top: 0x483d8b, mid: 0xff1493, bottom: 0xffa07a },
            night: { top: 0x010b1a, bottom: 0x004466 },
            haze: 0.6
        };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 1.0, g: 0.98, b: 0.9 };
    }

    public override getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        const banks = RiverSystem.getInstance().getBankPositions(z);
        const distToShore = x < banks.center ? banks.left - x : x - banks.right;
        const t = this.getBeachFactor(z, distToShore);

        // Mix the colors
        const color = this.SAND_COLOR.clone().lerp(this.GRASS_COLOR, t);
        return { r: color.r, g: color.g, b: color.b };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        const t = this.getBeachFactor(wz, distFromBank);

        const m = 0.1 + 0.3 * t;
        return m * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    private getBeachFactor(z: number, distToShore: number): number {
        // Noise varies from -1 to 1, we normalize to [0, 1]
        // Scale z by 0.05 for a smooth variation along the shoreline
        const noiseVal = (this.colorNoise.noise2D(z * 0.01, 0) + 1) / 2;

        // Transition distance varies
        const transitionDist = 20 + noiseVal * 30;

        // Calculate interpolation factor using smoothstep for a natural look
        const t = MathUtils.smoothstep(transitionDist * 0.75, transitionDist, distToShore);

        return t;
    }

    private shorelineRules(): DecorationRule[] {
        return [
            new TierRule({
                species: [
                    {
                        id: 'palm',
                        preference: SpeciesRules.fitness({
                            stepDistance: [5, 60],
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
        const patterns = {
            'dolphin_pods': Patterns.scatter({
                place: 'slalom',
                density: [0.4, 0.7],
                types: [EntityIds.DOLPHIN]
            }),
            'turtle_beaches': Patterns.scatter({
                place: 'near-shore',
                density: [0.3, 0.6],
                types: [EntityIds.TURTLE]
            }),
            'butterfly_swarms': Patterns.scatter({
                place: 'on-shore',
                density: [0.3, 0.6],
                types: [EntityIds.BUTTERFLY]
            }),
        };

        const riverTrack: TrackConfig = {
            name: 'river',
            stages: [
                {
                    name: 'dolphins',
                    progress: [0.0, 1.0],
                    scenes: [{ length: [100, 300], patterns: ['dolphin_pods'] }]
                }
            ]
        };

        const shoreTrack: TrackConfig = {
            name: 'near-shore',
            stages: [
                {
                    name: 'turtles',
                    progress: [0.0, 1.0],
                    scenes: [{ length: [100, 300], patterns: ['turtle_beaches'] }]
                }
            ]
        };

        const flyingTrack: TrackConfig = {
            name: 'flying',
            stages: [
                {
                    name: 'flying_animals',
                    progress: [0.4, 1.0],
                    scenes: [{ length: [100, 300], patterns: ['butterfly_swarms'] }]
                }
            ]
        };

        this.layoutCache = BoatPathLayoutStrategy.createLayout(this.zMin, this.zMax, {
            patterns: patterns,
            tracks: [riverTrack, shoreTrack, flyingTrack],
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
            Date.now()
        );
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        const layout = this.getLayout();
        yield* BoatPathLayoutSpawner.getInstance().spawnIterator(
            context, layout, this.id, zStart, zEnd, [this.zMin, this.zMax]);
    }
}
