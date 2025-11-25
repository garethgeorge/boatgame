import * as THREE from 'three';
import { Obstacle } from '../entities/Obstacle';
import { RiverGenerator } from '../world/RiverGenerator';

export class ObstacleManager {
    scene: THREE.Scene;
    obstacles: Obstacle[];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.obstacles = [];
    }

    update(dt: number, playerPosition: THREE.Vector3, riverGenerator: RiverGenerator) {
        // Dynamic spawning removed in favor of chunk-based spawning in RiverGenerator

        // Update and remove obstacles (only if any were added here, which they won't be anymore)
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            obstacle.update(dt, playerPosition);

            // Despawn if too far behind
            if (obstacle.position.z > playerPosition.z + 20) {
                obstacle.destroy();
                this.obstacles.splice(i, 1);
            }
        }
    }
}
