import * as THREE from 'three';
import { ObstacleManager } from './ObstacleManager.js';
import { CollectibleManager } from './CollectibleManager.js';
import { RiverGenerator } from '../world/RiverGenerator.js';

export class WorldManager {
    constructor(scene) {
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

    update(dt, playerPosition) {
        this.riverGenerator.update(playerPosition);
        this.obstacleManager.update(dt, playerPosition, this.riverGenerator);
        this.collectibleManager.update(dt, playerPosition, this.riverGenerator);
    }
}
