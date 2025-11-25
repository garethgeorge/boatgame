import * as THREE from 'three';
import { Collectible } from '../entities/Collectible';
import { RiverGenerator } from '../world/RiverGenerator';

export class CollectibleManager {
    scene: THREE.Scene;
    collectibles: Collectible[];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.collectibles = [];
    }

    update(dt: number, playerPosition: THREE.Vector3, riverGenerator: RiverGenerator) {
        // Dynamic spawning removed in favor of chunk-based spawning in RiverGenerator

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            collectible.update(dt);

            if (collectible.position.z > playerPosition.z + 20) {
                collectible.destroy();
                this.collectibles.splice(i, 1);
            }
        }
    }
}
