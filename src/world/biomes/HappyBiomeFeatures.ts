import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { DolphinSpawner } from '../../entities/spawners/DolphinSpawner';
import { RiverGeometry } from '../RiverGeometry';
import { Decorations, LSystemTreeKind } from '../Decorations';
import { TerrainDecorator, DecorationRule, PlacementManifest } from '../decorators/TerrainDecorator';
import { RiverSystem } from '../RiverSystem';

type HappyEntityType = 'dolphin' | 'bottle';

interface HappyBiomeLayout {
    boatPath: BoatPathLayout<HappyEntityType>;
    staticDecorations: PlacementManifest[];
}

interface HappyDecorationOptions {
    kind: 'oak' | 'willow' | 'poplar' | 'flower' | 'rock';
    rotation: number;
    scale: number;
}

/**
 * Happy Biome: A beautiful spring-like day with lush green fields.
 * Uses Context-Aware Archetypes for procedural placement.
 */
export class HappyBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'happy';

    private dolphinSpawner = new DolphinSpawner();

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

    private rules: DecorationRule[] = [
        // 1. Large Oak Trees - Solo giants suitable for hills
        {
            fitness: (ctx) => {
                if (ctx.distanceToRiver < 20) return 0; // Not too close to river
                if (ctx.slope > 0.93) return 0; // Not on cliffs (> ~53 degrees)
                // Prefer slightly elevated ground
                return 0.2 + (ctx.elevation * 0.05);
            },
            generate: (ctx) => {
                const scale = 1.0 + ctx.random() * 0.5;
                return {
                    radius: 8 * scale,
                    options: { kind: 'oak', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        },
        // 2. Willow Trees - Near water
        {
            fitness: (ctx) => {
                if (ctx.distanceToRiver < 5) return 0; // Not IN the river
                if (ctx.distanceToRiver > 25) return 0; // Only near river
                return 0.8;
            },
            generate: (ctx) => {
                const scale = 0.8 + ctx.random() * 0.4;
                return {
                    radius: 6 * scale,
                    options: { kind: 'willow', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        },
        // 3. Poplar Forests - Clustered
        {
            fitness: (ctx) => {
                if (ctx.distanceToRiver < 10) return 0;
                return 0.5;
            },
            generate: (ctx) => {
                const scale = 0.7 + ctx.random() * 0.6;
                return {
                    radius: 4 * scale,
                    options: { kind: 'poplar', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        },
        // 4. Flowers - Fillers
        {
            fitness: (ctx) => {
                if (ctx.distanceToRiver < 1.0) return 0.0;
                return 0.6; // General coverage
            },
            generate: (ctx) => ({
                radius: 2,
                options: { kind: 'flower', rotation: ctx.random() * Math.PI * 2, scale: 1.0 }
            })
        },
        // 5. Rocks - Shoreline and hills
        {
            fitness: (ctx) => {
                // Prefer close to water OR high slopes
                if (ctx.distanceToRiver < 1.0) return 0.0;
                if (ctx.distanceToRiver < 10) return 1.0;
                if (ctx.slope > 1.05) return 0.8; // High slopes (> ~60 degrees)
                return 0.1;
            },
            generate: (ctx) => {
                const scale = 0.8 + ctx.random() * 1.5;
                return {
                    radius: 3 * scale,
                    options: { kind: 'rock', rotation: ctx.random() * Math.PI * 2, scale }
                };
            }
        }
    ];

    public createLayout(zMin: number, zMax: number): HappyBiomeLayout {
        const boatPath = BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            patterns: {
                'dolphin_pods': {
                    logic: 'scatter',
                    place: 'slalom',
                    density: [1.0, 2.0],
                    types: ['dolphin']
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
                }
            ],
            waterAnimals: ['dolphin']
        });

        const staticDecorations = TerrainDecorator.generate(
            this.rules,
            { xMin: -200, xMax: 200, zMin, zMax },
            20,
            12345 // Fixed seed for now
        );

        return { boatPath, staticDecorations };
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const layout = context.layout as HappyBiomeLayout;

        // Safety check if layout or decorations are missing (e.g. if cast failed or old layout cached)
        if (!layout || !layout.staticDecorations) {
            console.warn("HappyBiome: No static decorations found in layout");
            return;
        }

        for (const manifest of layout.staticDecorations) {
            // Check z range. Manifests are global for the whole layout call, 
            // but we are only decorating a chunk segment here.
            if (!(zStart <= manifest.position.z && manifest.position.z < zEnd)) continue;

            const pos = {
                worldX: manifest.position.x,
                worldZ: manifest.position.z,
                height: manifest.position.y
            };

            const opts: HappyDecorationOptions = manifest.options as HappyDecorationOptions;

            switch (opts.kind) {
                case 'oak': {
                    const treeInstances = Decorations.getLSystemTreeInstance({ kind: 'oak' });
                    context.decoHelper.addInstancedDecoration(context, treeInstances, pos, opts.rotation, opts.scale);
                    break;
                }
                case 'willow': {
                    const treeInstances = Decorations.getLSystemTreeInstance({ kind: 'willow' });
                    context.decoHelper.addInstancedDecoration(context, treeInstances, pos, opts.rotation, opts.scale);
                    break;
                }
                case 'poplar': {
                    const treeInstances = Decorations.getLSystemTreeInstance({ kind: 'poplar' });
                    context.decoHelper.addInstancedDecoration(context, treeInstances, pos, opts.rotation, opts.scale);
                    break;
                }
                case 'flower': {
                    const flowerInstances = Decorations.getFlowerInstance();
                    context.decoHelper.addInstancedDecoration(context, flowerInstances, pos, opts.rotation, opts.scale);
                    break;
                }
                case 'rock': {
                    const rockInstances = Decorations.getRockInstance('happy', opts.scale);
                    context.decoHelper.addInstancedDecoration(context, rockInstances, pos, opts.rotation, opts.scale);
                    break;
                }
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const layout = context.biomeLayout as HappyBiomeLayout;
        if (!layout || !layout.boatPath) return;

        const boatPath = layout.boatPath;

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
