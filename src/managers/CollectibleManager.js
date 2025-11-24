import * as THREE from 'three';
import { Collectible } from '../entities/Collectible.js';

export class CollectibleManager {
    constructor(scene) {
        this.scene = scene;
        this.collectibles = [];
    }

    update(dt, playerPosition, riverGenerator) {
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
