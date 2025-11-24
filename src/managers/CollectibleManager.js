import * as THREE from 'three';
import { Collectible } from '../entities/Collectible.js';

export class CollectibleManager {
    constructor(scene) {
        this.scene = scene;
        this.collectibles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5; // Seconds
    }

    update(dt, playerPosition, riverGenerator) {
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnCollectible(playerPosition, riverGenerator);
            this.spawnTimer = 0;
        }

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            collectible.update(dt);

            if (collectible.position.z > playerPosition.z + 20) {
                collectible.destroy();
                this.collectibles.splice(i, 1);
            }
        }
    }

    spawnCollectible(playerPosition, riverGenerator) {
        const spawnDistance = 50;
        const z = playerPosition.z - spawnDistance;
        
        const center = riverGenerator.getRiverCenter(z);
        const spawnWidth = 20;
        const xOffset = (Math.random() - 0.5) * spawnWidth;
        
        const position = new THREE.Vector3(center.x + xOffset, 0, center.z);
        
        const collectible = new Collectible({
            scene: this.scene,
            position: position
        });
        
        this.collectibles.push(collectible);
    }
}
