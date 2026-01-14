import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';
import { Decorations, LSystemTreeKind } from '../Decorations';
import { IcebergSpawner } from '../../entities/spawners/IcebergSpawner';
import { PolarBearSpawner } from '../../entities/spawners/PolarBearSpawner';
import { PenguinKayakSpawner } from '../../entities/spawners/PenguinKayakSpawner';

export class IceBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'ice';

    private icebergSpawner = new IcebergSpawner();
    private polarBearSpawner = new PolarBearSpawner();
    private penguinKayakSpawner = new PenguinKayakSpawner();

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0xEE / 255, g: 0xFF / 255, b: 0xFF / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 400 };
    }

    protected skyTopColors: number[] = [0x0c1424, 0x888b8f, 0xc2c7da]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0x20283d, 0x85a2bd, 0xe5d9b2]; // [Night, Sunset, Noon]

    getRiverWidthMultiplier(): number {
        return 2.3;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            if (Math.random() > 0.8) {
                const isLeafless = Math.random() > 0.5;
                const kinds: LSystemTreeKind[] = ['oak', 'elm'];
                const kind = kinds[Math.floor(Math.random() * kinds.length)];
                const scale = 0.8 + Math.random() * 0.4;

                const treeInstances = Decorations.getLSystemTreeInstance({
                    kind,
                    variation: Math.random(),
                    isLeafLess: isLeafless,
                    isSnowy: true, // Snowy for the ice biome
                    scale
                });
                context.decoHelper.addInstancedDecoration(context, treeInstances, position);
            } else if (Math.random() > 0.9) {
                const rockInstances = Decorations.getRockInstance(this.id, Math.random());
                context.decoHelper.addInstancedDecoration(context, rockInstances, position);
            }
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await this.spawnObstacle(this.buoySpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.bottleSpawner, context, difficulty, zStart, zEnd);

        await this.spawnObstacle(this.icebergSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.penguinKayakSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.polarBearSpawner, context, difficulty, zStart, zEnd);
    }
}
