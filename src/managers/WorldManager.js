import * as THREE from 'three';
import { ObstacleManager } from './ObstacleManager.js';
import { CollectibleManager } from './CollectibleManager.js';

export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacleManager = new ObstacleManager(scene);
        this.collectibleManager = new CollectibleManager(scene);
        this.initWater();
        this.initLighting();
    }

    initWater() {
        const geometry = new THREE.PlaneGeometry(1000, 1000);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x0099ff,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8
        });
        this.water = new THREE.Mesh(geometry, material);
        this.water.rotation.x = -Math.PI / 2;
        this.water.receiveShadow = true;
        this.scene.add(this.water);
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
        // Move water with player to create infinite ocean illusion
        this.water.position.x = playerPosition.x;
        this.water.position.z = playerPosition.z;

        this.obstacleManager.update(dt, playerPosition);
        this.collectibleManager.update(dt, playerPosition);
    }
}
