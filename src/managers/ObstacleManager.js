import * as THREE from 'three';
import { Obstacle } from '../entities/Obstacle.js';

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2.0; // Seconds
    }

    update(dt, playerPosition, riverGenerator) {
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnObstacle(playerPosition, riverGenerator);
            this.spawnTimer = 0;
        }

        // Update and remove obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.update(dt);

            // Despawn if too far behind
            if (obstacle.position.z > playerPosition.z + 20) {
                obstacle.destroy();
                this.obstacles.splice(i, 1);
            }
        }
    }

    spawnObstacle(playerPosition, riverGenerator) {
        const type = Math.random() > 0.5 ? 'crocodile' : 'trash';
        
        const spawnDistance = 50;
        const z = playerPosition.z - spawnDistance;
        
        const center = riverGenerator.getRiverCenter(z);
        
        const spawnWidth = 20;
        const xOffset = (Math.random() - 0.5) * spawnWidth;
        
        const position = new THREE.Vector3(center.x + xOffset, 0, center.z);
        
        const obstacle = new Obstacle({
            scene: this.scene,
            position: position,
            type: type
        });
        
        this.obstacles.push(obstacle);
    }
}
