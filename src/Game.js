import * as THREE from 'three';
import { Boat } from './entities/Boat.js';
import { InputManager } from './managers/InputManager.js';
import { WorldManager } from './managers/WorldManager.js';

export class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.shadowMap.enabled = true;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.isPlaying = false;
        this.score = 0;
        
        // UI Elements
        this.startScreen = document.getElementById('start-screen');
        this.startBtn = document.getElementById('start-btn');
        this.scoreElement = document.getElementById('score');
        this.thrustElement = document.getElementById('thrust-display');
        
        this.startBtn.addEventListener('click', () => this.start());
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    init() {
        this.inputManager = new InputManager();
        this.worldManager = new WorldManager(this.scene);
        this.boat = new Boat(this.scene);
        
        // Initial camera position
        this.camera.position.set(0, 10, -10);
        this.camera.lookAt(0, 0, 0);

        this.animate();
    }

    start() {
        this.isPlaying = true;
        this.startScreen.style.display = 'none';
        this.clock.start();
    }

    update() {
        if (!this.isPlaying) return;

        const dt = this.clock.getDelta();
        const input = this.inputManager.getState();

        this.boat.update(dt, input, this.worldManager.riverGenerator);
        this.worldManager.update(dt, this.boat.position);

        this.checkCollisions();
        this.updateUI();

        // Camera follow
        const idealOffset = new THREE.Vector3(0, 5, -10);
        idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.boat.rotation);
        idealOffset.add(this.boat.position);
        
        this.camera.position.lerp(idealOffset, dt * 2.0);
        this.camera.lookAt(this.boat.position);
    }

    checkCollisions() {
        // Check Obstacles
        const obstacles = this.worldManager.obstacleManager.obstacles;
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            const dist = this.boat.position.distanceTo(obstacle.position);
            
            if (dist < this.boat.radius + obstacle.radius) {
                // Collision!
                this.score = Math.floor(this.score * 0.9); // Lose 10%
                this.updateScore();
                
                // Visual feedback (flash red)
                this.boat.mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        const oldColor = child.material.color.clone();
                        child.material.color.setHex(0xff0000);
                        setTimeout(() => child.material.color.copy(oldColor), 200);
                    }
                });

                // Remove obstacle
                obstacle.destroy();
                obstacles.splice(i, 1);
            }
        }

        // Check Collectibles
        const collectibles = this.worldManager.collectibleManager.collectibles;
        for (let i = collectibles.length - 1; i >= 0; i--) {
            const collectible = collectibles[i];
            const dist = this.boat.position.distanceTo(collectible.position);
            
            if (dist < this.boat.radius + collectible.radius) {
                // Collected!
                this.score += 100;
                this.updateScore();
                
                // Remove collectible
                collectible.destroy();
                collectibles.splice(i, 1);
            }
        }
    }

    updateUI() {
        const throttlePercent = Math.round(this.boat.physics.throttle * 100);
        this.thrustElement.innerText = `Thrust: ${throttlePercent}%`;
    }

    updateScore() {
        this.scoreElement.innerText = `Score: ${this.score}`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
