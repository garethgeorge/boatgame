import * as THREE from 'three';
import { BaseDecorator } from './BaseDecorator';
import { DecorationContext } from './TerrainDecorator';
import { TerrainChunk } from '../TerrainChunk';

export abstract class ShoreAnimalDecorator extends BaseDecorator {
    protected async decorateShoreAnimal(
        context: DecorationContext,
        biomeFilter: string,
        spawnProbability: number,
        getAnimalModel: () => { model: THREE.Group; animations: THREE.AnimationClip[] }
    ): Promise<void> {
        const count = 2; // Try 2 times per chunk, similar to original

        for (let i = 0; i < count; i++) {
            const localZ = Math.random() * TerrainChunk.CHUNK_SIZE;
            const worldZ = context.zOffset + localZ;
            const biomeType = context.riverSystem.getBiomeManager().getBiomeType(worldZ);

            if (biomeType !== biomeFilter) continue;
            if (Math.random() >= spawnProbability) continue;

            const placement = this.calculateShoreAnimalPlacement(worldZ, context);

            // Check slope (must be < 20 degrees from upright)
            const normal = context.riverSystem.terrainGeometry.calculateNormal(placement.worldX, placement.worldZ);
            const up = new THREE.Vector3(0, 1, 0);
            if (normal.angleTo(up) > THREE.MathUtils.degToRad(20)) continue;

            const animalData = getAnimalModel();
            this.placeShoreAnimal(animalData, placement, context);
        }
    }

    private calculateShoreAnimalPlacement(worldZ: number, context: DecorationContext) {
        const riverWidth = context.riverSystem.getRiverWidth(worldZ);
        const riverCenter = context.riverSystem.getRiverCenter(worldZ);
        const isLeftBank = Math.random() > 0.5;
        const distFromBank = 2.5 + Math.random() * 3.0;
        const localX = (isLeftBank ? -1 : 1) * (riverWidth / 2 + distFromBank);
        const worldX = localX + riverCenter;
        const height = context.riverSystem.terrainGeometry.calculateHeight(worldX, worldZ);

        return { localX, worldX, worldZ, height, isLeftBank };
    }

    private placeShoreAnimal(
        animalData: { model: THREE.Group; animations: THREE.AnimationClip[] },
        placement: { localX: number; worldX: number; worldZ: number; height: number; isLeftBank: boolean },
        context: DecorationContext
    ): void {
        const animal = animalData.model;
        animal.position.set(placement.worldX, placement.height, placement.worldZ);

        // Calculate and apply rotation
        const terrainNormal = context.riverSystem.terrainGeometry.calculateNormal(placement.worldX, placement.worldZ);
        this.orientAnimalToTerrain(animal, terrainNormal, placement.isLeftBank, placement.worldZ, context);

        // Scale
        const baseScale = 3.0;
        const scale = baseScale * (0.9 + Math.random() * 0.2);
        animal.scale.set(scale, scale, scale);

        // Setup animation
        if (animalData.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(animal);
            // Randomize start time
            const action = mixer.clipAction(animalData.animations[0]);
            action.time = Math.random() * action.getClip().duration;
            action.play();
            context.animationMixers.push(mixer);
        }

        // Enable shadows
        animal.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        context.geometryGroup.add(animal);
    }

    private orientAnimalToTerrain(
        animal: THREE.Group,
        terrainNormal: THREE.Vector3,
        isLeftBank: boolean,
        worldZ: number,
        context: DecorationContext
    ): void {
        // Align model's Y-axis with terrain normal
        const modelUpAxis = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(modelUpAxis, terrainNormal);
        animal.quaternion.copy(quaternion);

        // Rotate around normal to face water with +/- 45 degrees variation
        const riverDerivative = context.riverSystem.getRiverDerivative(worldZ);
        const riverAngle = Math.atan(riverDerivative);
        let baseAngle = isLeftBank ? Math.PI / 2 : -Math.PI / 2;
        baseAngle += riverAngle;

        // Add random variation between -45 and +45 degrees (PI/4)
        baseAngle += (Math.random() - 0.5) * (Math.PI / 2);

        const rotationAroundNormal = new THREE.Quaternion();
        rotationAroundNormal.setFromAxisAngle(terrainNormal, baseAngle);
        animal.quaternion.premultiply(rotationAroundNormal);
    }
}
