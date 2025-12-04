import * as THREE from 'three';
import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { PolarBear } from '../../entities/obstacles/PolarBear';
import { RiverSystem } from '../../world/RiverSystem';

export class PolarBearSpawner implements Spawnable {
    id = 'polarbear';

    getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
        // Only spawn in ice biome
        if (biomeType !== 'ice') return 0;

        const probability = 0.3 / chunkLength; // roughly 0.3 bears per 15m chunk

        return Math.random() * probability
    }

    async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
        const riverSystem = RiverSystem.getInstance();

        for (let i = 0; i < count; i++) {
            // Try multiple times to find a valid shore placement
            let placed = false;
            const maxAttempts = 20;

            for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
                // Random Z position in chunk
                const z = context.zStart + Math.random() * (context.zEnd - context.zStart);

                const placement = this.calculateShoreAnimalPlacement(z, riverSystem);

                // Check slope (must be < 20 degrees from upright)
                const normal = riverSystem.terrainGeometry.calculateNormal(placement.localX, placement.worldZ);
                const up = new THREE.Vector3(0, 1, 0);
                if (normal.angleTo(up) > THREE.MathUtils.degToRad(20))
                    continue;

                // Rotate around normal to face water with +/- 45 degrees variation
                const riverDerivative = riverSystem.getRiverDerivative(placement.worldZ);
                const riverAngle = Math.atan(riverDerivative);
                let baseAngle = placement.isLeftBank ? Math.PI / 2 : -Math.PI / 2;
                baseAngle += riverAngle;

                // Add random variation between -45 and +45 degrees (PI/4)
                baseAngle += (Math.random() - 0.5) * (Math.PI / 2);

                // Create the polar bear entity with terrain-based positioning
                const entity = new PolarBear(
                    placement.worldX,
                    placement.worldZ,
                    context.physicsEngine,
                    baseAngle,
                    placement.height,
                    normal,
                    baseAngle
                );

                context.entityManager.add(entity, context.chunkIndex);
                placed = true;
            }
        }
    }

    private calculateShoreAnimalPlacement(worldZ: number, riverSystem: RiverSystem) {
        const riverWidth = riverSystem.getRiverWidth(worldZ);
        const riverCenter = riverSystem.getRiverCenter(worldZ);
        const isLeftBank = Math.random() > 0.5;
        const distFromBank = 2.5 + Math.random() * 3.0;
        const localX = (isLeftBank ? -1 : 1) * (riverWidth / 2 + distFromBank);
        const worldX = localX + riverCenter;
        const height = riverSystem.terrainGeometry.calculateHeight(localX, worldZ);

        return { localX, worldX, worldZ, height, isLeftBank };
    }

}
