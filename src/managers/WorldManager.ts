import * as THREE from 'three';
import { ObstacleManager } from './ObstacleManager';
import { CollectibleManager } from './CollectibleManager';
import { RiverGenerator } from '../world/RiverGenerator';

export class WorldManager {
    scene: THREE.Scene;
    riverGenerator: RiverGenerator;
    obstacleManager: ObstacleManager;
    collectibleManager: CollectibleManager;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.riverGenerator = new RiverGenerator(scene);
        this.obstacleManager = new ObstacleManager(scene);
        this.collectibleManager = new CollectibleManager(scene);
        this.initLighting();
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        this.scene.add(dirLight);
    }

    update(dt: number, playerPosition: THREE.Vector3) {
        this.riverGenerator.update(playerPosition, dt);
        this.obstacleManager.update(dt, playerPosition, this.riverGenerator);
        this.collectibleManager.update(dt, playerPosition, this.riverGenerator);
    }
}
