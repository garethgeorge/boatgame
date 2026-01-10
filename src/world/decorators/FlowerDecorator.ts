import * as THREE from 'three';
import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { Decorations, DecorationInstance } from '../Decorations';

export class FlowerDecorator extends BaseDecorator {
    async decorate(context: DecorationContext, zStart?: number, zEnd?: number): Promise<void> {
        const startZ = zStart !== undefined ? zStart : context.zOffset;
        const endZ = zEnd !== undefined ? zEnd : context.zOffset + 62.5; // TerrainChunk.CHUNK_SIZE;

        // Number of flowers per chunk segment
        const count = 300 * ((endZ - startZ) / 62.5);
        const worldPos = new THREE.Vector3();
        const worldMatrix = new THREE.Matrix4();

        // Create flower patches
        const numPatches = 5 + Math.floor(Math.random() * 5);
        const flowersPerPatch = Math.floor(count / numPatches);

        for (let p = 0; p < numPatches; p++) {
            // Find a valid center for the patch
            let patchCenter;
            let attempts = 0;
            while (attempts < 10) {
                patchCenter = this.generateRandomPositionInRange(context, startZ, endZ);
                if (this.isValidDecorationPosition(context, patchCenter)) break;
                attempts++;
            }
            if (!patchCenter || !this.isValidDecorationPosition(context, patchCenter)) continue;

            const patchRadius = 5 + Math.random() * 10;

            for (let i = 0; i < flowersPerPatch; i++) {
                // Random offset within patch radius
                const angle = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * patchRadius;
                const offsetX = Math.cos(angle) * r;
                const offsetZ = Math.sin(angle) * r;

                const wx = patchCenter.worldX + offsetX;
                const wz = patchCenter.worldZ + offsetZ;
                const height = context.riverSystem.terrainGeometry.calculateHeight(wx, wz);

                const pos = { worldX: wx, worldZ: wz, height };
                if (!this.isValidDecorationPosition(context, pos)) continue;

                // Get flower instances from Decorations
                const flowerInstances = Decorations.getFlowerInstance();

                // Add as instanced decoration at the world position
                // Note: rotation and scale are already randomized within getFlowerInstance archetypes
                context.decoHelper.addInstancedDecoration(context, flowerInstances, pos, 0, 1.0);
            }
        }
    }
}
