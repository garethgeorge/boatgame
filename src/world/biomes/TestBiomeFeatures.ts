import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { PopulationContext } from './PopulationContext';
import { BiomeType } from './BiomeType';
import { BoatPathLayoutConfig } from '../layout/BoatPathLayoutStrategy';
import { EntityIds } from '../../entities/EntityIds';
import { Combine, Select, Signal, TierRule } from '../decorators/DecorationRuleBuilders';
import { RiverSystem } from '../RiverSystem';
import { RiverGeometry } from '../RiverGeometry';
import { DecorationConfig, TerrainDecorator } from '../decorators/TerrainDecorator';
import { Decorations } from '../decorations/Decorations';
import { off } from 'node:cluster';
import { LayoutRules } from '../layout/LayoutRuleBuilders';
// AnimalEntityRules removed as it was unused here
import { DragonflyRule, ParrotRule } from '../../entities/AnimalLayoutRules';
import { AnimalSpawner } from '../../entities/spawners/AnimalSpawner';
import { Monkey } from '../../entities/obstacles';
import { Fitness, PropParams } from '../decorations/SceneryRules';
import { Place } from '../layout/BoatPathLayoutShortcuts';
import { BirdOnBeachChairRule } from '../../entities/VignetteLayoutRules';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, TestBiomeFeatures.LENGTH, direction);
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

    private decorationConfig: DecorationConfig | null = null;

    public getDecorationConfig(): DecorationConfig {
        if (this.decorationConfig) return this.decorationConfig;

        const rules = [
            new TierRule({
                species: [
                    {
                        id: 'chair',
                        preference: Fitness.make({
                            stepDistance: [5, 20],
                            slope: [0, 10],
                            stepNoise: { scale: 20, threshold: 0.7 }
                        }),
                        params: Select.choose([
                            PropParams.beach_chair(),
                            // PropParams.umbrella_with_chairs(1),
                            // PropParams.umbrella_with_chairs(2)
                        ])
                    }
                ]
            }),
        ];

        this.decorationConfig = { rules, maps: {} };
        return this.decorationConfig;
    }

    protected getLayoutConfig(): BoatPathLayoutConfig {
        return {
            tracks: [{
                name: 'flying',
                stages: [{
                    name: 'flying_animals',
                    progress: [0.0, 1.0],
                    scenes: [{
                        length: [100, 300],
                        patterns: [
                            Place.scatter_onShore(ParrotRule.get('chair', PropParams.beach_chair_slot), [0.8, 0.8])
                            //Place.scatter_onShore(BirdOnBeachChairRule.get(), [0.4, 0.8])
                        ]
                    }]
                }]
            }],
            path: {
                length: [200, 100]
            }
        };
    }

    * populate(context: PopulationContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        yield* super.populate(context, difficulty, zStart, zEnd);
        return;

        // 1. Decorate
        const spatialGrid = context.chunk.spatialGrid;
        yield* TerrainDecorator.decorateIterator(
            context,
            this.decorationConfig,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            [],
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
