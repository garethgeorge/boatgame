import * as THREE from 'three';
import { Obstacle } from '../entities/Obstacle.js';

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
    }

    update(dt, playerPosition, riverGenerator) {
        // Dynamic spawning removed in favor of chunk-based spawning in RiverGenerator
        
        // Update and remove obstacles (only if any were added here, which they won't be anymore)
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
}
