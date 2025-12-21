import { TransformNode, Vector3 } from '@babylonjs/core';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { TerrainChunk } from '../TerrainChunk';

export class BiomeDecorationHelper {
    public generateRandomPositionInRange(context: DecorationContext, zStart: number, zEnd: number): { worldX: number; worldZ: number; height: number } {
        const dz = Math.random() * (zEnd - zStart);
        const wz = zStart + dz;
        const u = Math.random() * 2 - 1;
        const dx = u * (TerrainChunk.CHUNK_WIDTH / 2);
        const riverCenter = context.riverSystem.getRiverCenter(wz);
        const wx = dx + riverCenter;
        const height = context.riverSystem.terrainGeometry.calculateHeight(wx, wz);

        return { worldX: wx, worldZ: wz, height };
    }

    public isValidDecorationPosition(
        context: DecorationContext,
        position: { worldX: number; worldZ: number; height: number }
    ): boolean {
        const riverWidth = context.riverSystem.getRiverWidth(position.worldZ);
        const riverCenter = context.riverSystem.getRiverCenter(position.worldZ);
        const distFromCenter = Math.abs(position.worldX - riverCenter);
        const distFromBank = distFromCenter - riverWidth / 2;

        // Apply distance-based probability bias
        if (distFromBank > 0) {
            const biasDistance = 80;
            const normalizedDist = Math.min(1.0, distFromBank / biasDistance);
            const probability = Math.pow(1.0 - normalizedDist, 2);
            if (Math.random() > probability) return false;
        }

        // Check minimum height
        if (position.height < 2.0) return false;

        // Check visibility
        if (!context.riverSystem.terrainGeometry.checkVisibility(position.worldX, position.height, position.worldZ)) {
            return false;
        }

        return true;
    }

    public positionAndCollectGeometry(
        object: TransformNode,
        position: { worldX: number; height: number; worldZ: number },
        context: DecorationContext
    ): void {
        object.position.set(position.worldX, position.height, position.worldZ);
        object.rotation.y = Math.random() * Math.PI * 2;

        // Parent to the root context node
        object.parent = context.root;
    }
}
