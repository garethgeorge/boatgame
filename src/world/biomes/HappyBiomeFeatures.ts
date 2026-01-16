import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { DolphinSpawner } from '../../entities/spawners/DolphinSpawner';
import { ButterflySpawner } from '../../entities/spawners/ButterflySpawner';
import { RiverGeometry } from '../RiverGeometry';
import { TerrainDecorator, DecorationRule, PlacementManifest } from '../decorators/TerrainDecorator';
import { Combine, Signal, SpeciesHelpers, TierRule } from '../decorators/PoissonDecorationRules';

type HappyEntityType = 'dolphin' | 'butterfly' | 'bottle';

/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Uses Context-Aware Archetypes for procedural placement.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';

    private dolphinSpawner = new DolphinSpawner();
    private butterflySpawner = new ButterflySpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        // Lush green ground color
        return { r: 0x33 / 255, g: 0xaa / 255, b: 0x33 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.9, g: 0.95, b: 1.0 };
    }

    protected skyTopColors: number[] = [0x303948, 0xf6b581, 0x01cad1]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x5b6831, 0xf7efbc, 0xb0ece6]; // [Night, Sunset, Noon]

    public getBiomeLength(): number {
        return 1500;
    }

    private decorationRules: DecorationRule[] = [
        new TierRule({
            species: [
                {
                    id: 'willow_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.inRange(Signal.distanceToRiver, 5, 25),
                        Signal.inRange(Signal.elevation, 1.0, 5.0),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            radius: 8 * scale,
                            options: { kind: 'willow', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
                {
                    id: 'oak_tree',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.linearRange(Signal.distanceToRiver, 5, 50),
                        Signal.inRange(Signal.elevation, 3.0, 20.0),
                        Signal.inRange(Signal.slope, 0, 50)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            radius: SpeciesHelpers.attenuate(ctx, 12 * scale),
                            options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                }
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'poplar',
                    preference: Combine.all(
                        Signal.step(Signal.noise2D(500.0, 250.0), 0.7),
                        Signal.inRange(Signal.distanceToRiver, 5, 40),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.7 + ctx.random() * 0.6;
                        return {
                            radius: 4 * scale,
                            options: { kind: 'poplar', rotation: ctx.random() * Math.PI * 2, scale }
                        }
                    }
                },
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'rock',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.inRange(Signal.distanceToRiver, 3, 20),
                        Signal.inRange(Signal.elevation, 6.0),
                        Signal.inRange(Signal.slope, 50)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.8;
                        return {
                            radius: 10.0 * scale,
                            options: { kind: 'rock', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
            ]
        }),
        new TierRule({
            species: [
                {
                    id: 'flower',
                    preference: Combine.all(
                        Signal.constant(1.0),
                        Signal.inRange(Signal.distanceToRiver, 5, 25),
                        Signal.inRange(Signal.elevation, 1.0, 5.0),
                        Signal.inRange(Signal.slope, 0, 15)
                    ),
                    params: (ctx) => {
                        const scale = 0.8 + ctx.random() * 0.4;
                        return {
                            radius: 1.0 * scale,
                            options: { kind: 'flower', rotation: ctx.random() * Math.PI * 2, scale }
                        };
                    }
                },
            ]
        })
    ];

    public createLayout(zMin: number, zMax: number): BoatPathLayout<HappyEntityType> {
        const boatPath = BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'dolphin_pods': {
                    logic: 'scatter',
                    place: 'slalom',
                    density: [1.0, 2.0],
                    types: ['dolphin']
                },
                'butterfly_swarms': {
                    logic: 'scatter',
                    place: 'shore',
                    density: [3.0, 5.0],
                    types: ['butterfly']
                }
            },
            tracks: [
                {
                    name: 'animals',
                    stages: [
                        {
                            name: 'dolphin_waters',
                            progress: [0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'dolphin_pods', weight: 1.0 }
                                ]
                            ]
                        }
                    ]
                },
                {
                    name: 'butterflies',
                    stages: [
                        {
                            name: 'butterfly_meadows',
                            progress: [0, 1.0],
                            patterns: [
                                [
                                    { pattern: 'butterfly_swarms', weight: 1.0 }
                                ]
                            ]
                        }
                    ]
                }
            ],
            waterAnimals: ['dolphin']
        });

        return boatPath;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        TerrainDecorator.decorate(
            context,
            this.decorationRules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            20,
            12345 // Fixed seed for now
        );
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const boatPath = context.biomeLayout as BoatPathLayout<HappyEntityType>;
        if (!boatPath) return;

        const iChunkStart = RiverGeometry.getPathIndexByZ(boatPath.path, zStart);
        const iChunkEnd = RiverGeometry.getPathIndexByZ(boatPath.path, zEnd);

        const iChunkMin = Math.min(iChunkStart, iChunkEnd);
        const iChunkMax = Math.max(iChunkStart, iChunkEnd);

        for (const section of boatPath.sections) {
            if (section.iEnd <= iChunkMin || section.iStart >= iChunkMax) continue;

            for (const [entityType, placements] of Object.entries(section.placements)) {
                if (!placements) continue;

                for (const p of placements) {
                    if (p.index >= iChunkMin && p.index < iChunkMax) {
                        const sample = RiverGeometry.getPathPoint(boatPath.path, p.index);

                        switch (entityType as HappyEntityType) {
                            case 'dolphin':
                                await this.dolphinSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'butterfly':
                                await this.butterflySpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'bottle':
                                // Bottle spawner assumed to exist in Base or similar
                                // await this.bottleSpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                        }
                    }
                }
            }
        }
    }
}
