import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { BrownBearSpawner } from '../../entities/spawners/BrownBearSpawner';
import { MooseSpawner } from '../../entities/spawners/MooseSpawner';
import { DucklingSpawner } from '../../entities/spawners/DucklingSpawner';
import { BoatPathLayout, BoatPathLayoutStrategy } from './BoatPathLayoutStrategy';
import { RiverGeometry } from '../RiverGeometry';

type ForestEntityType = 'log' | 'rock' | 'buoy' | 'bear' | 'moose' | 'duckling' | 'pier';

export class ForestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'forest';

    private bearSpawner = new BrownBearSpawner();
    private mooseSpawner = new MooseSpawner();
    private ducklingSpawner = new DucklingSpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x11 / 255, g: 0x55 / 255, b: 0x11 / 255 };
    }

    getSkyColors(dayness: number): { top: THREE.Color, bottom: THREE.Color } {
        const colors = super.getSkyColors(dayness);
        if (dayness > 0) {
            const forestTopMod = new THREE.Color(0x4488ff); // Crisp Blue
            const forestBotMod = new THREE.Color(0xcceeff); // White/Blue Horizon
            colors.top.lerp(forestTopMod, 0.6);
            colors.bottom.lerp(forestBotMod, 0.6);
        }
        return colors;
    }

    public getBiomeLength(): number {
        return 2000;
    }

    public createLayout(zMin: number, zMax: number): BoatPathLayout<ForestEntityType> {
        return BoatPathLayoutStrategy.createLayout(zMin, zMax, {
            animalGroups: [['moose', 'bear']],
            slalomGroups: [['log', 'rock', 'buoy', 'pier']],
            pathGroups: [['duckling']],
            waterAnimals: ['duckling'],
            weights: {
                'moose': 1, 'bear': 1,
                'log': 30, 'rock': 40, 'buoy': 15, 'pier': 15,
                'duckling': 1
            },
            slalomDensity: { start: 1.0, end: 3.0 },
            animalDensity: { start: 0.8, end: 2.5 },
            pathDensity: { start: 0.5, end: 2.0 },
            biomeLength: this.getBiomeLength()
        });
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            if (Math.random() > 0.8) {
                const tree = Decorations.getTree(Math.random(), false, false);
                context.decoHelper.positionAndCollectGeometry(tree, position, context);
            } else if (Math.random() > 0.95) {
                const rock = Decorations.getRock(this.id, Math.random());
                context.decoHelper.positionAndCollectGeometry(rock, position, context);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        const layout = context.biomeLayout as BoatPathLayout<ForestEntityType>;
        if (!layout) return;

        // Map world Z range to path indices
        const iChunkStart = RiverGeometry.getPathIndexByZ(layout.path, zStart);
        const iChunkEnd = RiverGeometry.getPathIndexByZ(layout.path, zEnd);

        const iChunkMin = Math.min(iChunkStart, iChunkEnd);
        const iChunkMax = Math.max(iChunkStart, iChunkEnd);

        for (const section of layout.sections) {
            if (section.iEnd <= iChunkMin || section.iStart >= iChunkMax) continue;

            for (const [entityType, placements] of Object.entries(section.placements)) {
                if (!placements) continue;

                for (const p of placements) {
                    if (p.index >= iChunkMin && p.index < iChunkMax) {
                        const sample = RiverGeometry.getPathPoint(layout.path, p.index);

                        switch (entityType as ForestEntityType) {
                            case 'log':
                                await this.logSpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                            case 'rock':
                                await this.rockSpawner.spawnInRiverAbsolute(context, sample, false, 'forest', p.range);
                                break;
                            case 'buoy':
                                await this.buoySpawner.spawnInRiverAbsolute(context, sample, p.range);
                                break;
                            case 'pier':
                                // For the forest, we can just spawn piers as slalom obstacles on the banks
                                await this.pierSpawner.spawnAt(context, sample.centerPos.z, Math.random() < 0.5);
                                break;
                            case 'moose':
                                await this.mooseSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'bear':
                                await this.bearSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                            case 'duckling':
                                await this.ducklingSpawner.spawnAnimalAbsolute(context, sample, p.range, p.aggressiveness || 0.5);
                                break;
                        }
                    }
                }
            }
        }
    }
}
