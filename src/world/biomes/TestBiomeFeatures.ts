import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { EntityIds } from '../../entities/EntityIds';
import { DecorationRule } from '../decorators/PoissonDecorationStrategy';
import { Combine, Signal, TierRule } from '../decorators/PoissonDecorationRules';
import { RiverSystem } from '../RiverSystem';
import { RiverGeometry } from '../RiverGeometry';
import { DecorationConfig, TerrainDecorator } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { off } from 'node:cluster';
import { EntityRules } from './decorations/EntityLayoutRules';
// AnimalEntityRules removed as it was unused here
import { DragonflyRule } from '../../entities/AnimalEntityRules';
import { AnimalSpawner } from '../../entities/spawners/AnimalSpawner';
import { Monkey } from '../../entities/obstacles';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, TestBiomeFeatures.LENGTH, direction);
    }

    private decorationConfig: DecorationConfig = {
        maps: {},
        rules: [
            /*
            new TierRule({
                species: [
                    {
                        id: 'land',
                        preference: Combine.all(
                            Signal.constant(1.0),
                            Signal.inRange(Signal.distanceToRiver, 5, 25),
                        ),
                        params: (ctx) => {
                            const scale = 0.8 + ctx.random() * 0.4;
                            const kinds = ['daisy', 'lily', 'waterlily'];
                            const kind = kinds[Math.floor(Math.random() * 3)];
                            return {
                                groundRadius: 0.5 * scale,
                                options: {
                                    kind: kind,
                                    rotation: ctx.random() * Math.PI * 2,
                                    scale
                                },
                                spacing: 4.0
                            };
                        }
                    },
                ]
            })
                */
        ]
    };

    public getDecorationConfig(): DecorationConfig {
        return this.decorationConfig;
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    public override getAmplitudeMultiplier(wx: number, wz: number, distFromBank: number): number {
        return 0.2 * super.getAmplitudeMultiplier(wx, wz, distFromBank);
    }

    * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // 1. Decorate
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            this.decorationConfig,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            spatialGrid,
            12345 // Fixed seed for now
        );

        // 2. Spawn
        const biomeRange: [number, number] = [this.zMin, this.zMax];

        const river = RiverSystem.getInstance();
        const sample = RiverGeometry.getRiverGeometrySample(river, (zStart + zEnd) / 2);
        const distanceRange: [number, number] = [sample.bankDist, sample.bankDist + 10];
        const offset = distanceRange[0] + Math.random() * (distanceRange[1] - distanceRange[0]);
        const x = sample.centerPos.x + sample.normal.x * offset;
        const z = sample.centerPos.z + sample.normal.z * offset;

        yield* Decorations.ensureAllLoaded(['monkey']);

        AnimalSpawner.createEntity(Monkey, context,
            x, z, 0, 0, new THREE.Vector3(0, 1, 0),
            {
                aggressiveness: 0.5,
                behavior: { type: 'walk-attack', logicName: 'WolfAttack' },
                biomeZRange: biomeRange
            }
        );
    }
}
