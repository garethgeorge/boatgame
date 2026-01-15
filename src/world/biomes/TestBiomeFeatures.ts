import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { Decorations, LSystemTreeKind } from '../Decorations';
import { DecorationRule, PlacementManifest } from '../decorators/PoissonDecorationStrategy';
import { Combine, Signal, SpeciesHelpers, TierRule } from '../decorators/PoissonDecorationRules';
import { TerrainDecorator } from '../decorators/TerrainDecorator';

interface TestDecorationOptions {
    kind: 'nothing' | 'willow' | 'oak' | 'flower';
    rotation: number;
    scale: number;
}

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';

    private rules: DecorationRule[] = [
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

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    public getAmplitudeMultiplier(): number {
        return 1.0;
    }

    public createLayout(zMin: number, zMax: number): any {
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {

        const placements = TerrainDecorator.generate(
            this.rules,
            { xMin: -200, xMax: 200, zMin: zStart, zMax: zEnd },
            20,
            12345 // Fixed seed for now
        );

        for (const manifest of placements) {
            // Check z range. Manifests are global for the whole layout call, 
            // but we are only decorating a chunk segment here.
            if (!(zStart <= manifest.position.z && manifest.position.z < zEnd)) continue;

            const pos = {
                worldX: manifest.position.x,
                worldZ: manifest.position.z,
                height: manifest.position.y
            };

            const opts = manifest.options as TestDecorationOptions;

            switch (opts.kind) {
                case 'nothing': {
                    break;
                }
                case 'willow': {
                    const treeInstances = Decorations.getLSystemTreeInstance({ kind: 'willow' });
                    context.decoHelper.addInstancedDecoration(context, treeInstances, pos, opts.rotation, opts.scale);
                    break;
                }
                case 'oak': {
                    const treeInstances = Decorations.getLSystemTreeInstance({ kind: 'oak' });
                    context.decoHelper.addInstancedDecoration(context, treeInstances, pos, opts.rotation, opts.scale);
                    break;
                }
                case 'flower': {
                    const flowerInstances = Decorations.getFlowerInstance();
                    context.decoHelper.addInstancedDecoration(context, flowerInstances, pos, opts.rotation, opts.scale);
                    break;
                }
            }
        }
    }

    private spawner = new MonkeySpawner();

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        //await this.bottleSpawner.spawn(context, 4, zStart, zEnd);
        //await this.spawner.spawn(context, 2, zStart, zEnd);
    }
}
