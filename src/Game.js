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
        // Check Obstacles & Piers (Unified list? No, separate managers or lists?)
        // WorldManager has obstacleManager.
        // RiverGenerator has chunks, chunks have decorations.
        // The current Game.js uses worldManager.obstacleManager.obstacles.
        // But RiverGenerator spawns Obstacles and Piers into 'decorations' list of chunks?
        // Wait, RiverGenerator.js: decorations.push(new Obstacle(...));
        // And Obstacle extends Entity.
        // Does WorldManager track them?
        // Let's check WorldManager.
        // If not, I need to iterate chunks.
        // The previous code: const obstacles = this.worldManager.obstacleManager.obstacles;
        // This implies ObstacleManager exists.
        // But RiverGenerator creates them.
        // Let's assume RiverGenerator adds them to chunks, and maybe ObstacleManager is not used for these?
        // Or maybe RiverGenerator adds them to the scene and also to a list?
        // In RiverGenerator: decorations.push(decoration);
        // And chunk.decorations = decorations.
        // So they are in chunks.
        
        // I need to iterate over active chunks and their decorations.
        const chunks = this.worldManager.riverGenerator.chunks;
        
        chunks.forEach(chunk => {
            if (!chunk.decorations) return;
            
            for (let i = chunk.decorations.length - 1; i >= 0; i--) {
                const deco = chunk.decorations[i];
                
                // Skip if already collected/hit (inactive)
                if (deco.active === false) continue;
                
                // Collectibles
                if (deco.constructor.name === 'Collectible') {
                    const dist = this.boat.position.distanceTo(deco.position);
                    if (dist < this.boat.radius + deco.radius) {
                        // Collected!
                        this.score += deco.points;
                        this.updateScore();
                        
                        // Trigger animation
                        deco.collect();
                    }
                }
                // Obstacles (Log, Crocodile, Tire, BeachBall)
                else if (deco.constructor.name === 'Obstacle') {
                    if (deco.type === 'log') {
                        // Rectangular collision
                        const result = this.boat.physics.checkRectangularCollision(
                            this.boat.position,
                            this.boat.radius,
                            deco.position,
                            deco.size,
                            deco.mesh.rotation.y // Log rotation
                        );
                        
                        if (result.collided) {
                            // Push out
                            this.boat.position.add(result.normal.multiplyScalar(result.penetration));
                            
                            // Sliding response:
                            // Remove velocity component towards the obstacle
                            const vDotN = this.boat.physics.velocity.dot(result.normal);
                            if (vDotN < 0) {
                                const vNormal = result.normal.clone().multiplyScalar(vDotN);
                                this.boat.physics.velocity.sub(vNormal);
                                
                                // Optional: Apply friction to the remaining tangent velocity
                                this.boat.physics.velocity.multiplyScalar(0.9);
                            }
                        }
                    } else {
                        // Radius collision
                        const dist = this.boat.position.distanceTo(deco.position);
                        if (dist < this.boat.radius + deco.radius) {
                            // Penalty
                            this.score = Math.floor(this.score * 0.9); // Lose 10%
                            this.updateScore();
                            
                            // Visual feedback
                            this.boat.mesh.traverse(child => {
                                if (child.isMesh && child.material) {
                                    const oldColor = child.material.color.clone();
                                    child.material.color.setHex(0xff0000);
                                    setTimeout(() => child.material.color.copy(oldColor), 200);
                                }
                            });

                            // Trigger animation
                            deco.hit();
                        }
                    }
                }
                // Piers
                else if (deco.constructor.name === 'Pier') {
                    // Rectangular collision
                    // Pier center is offset!
                    const center = deco.position.clone().add(
                        deco.centerOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), deco.rotationY)
                    );
                    
                    const result = this.boat.physics.checkRectangularCollision(
                        this.boat.position,
                        this.boat.radius,
                        center,
                        deco.size,
                        deco.rotationY
                    );
                    
                    if (result.collided) {
                        // Push out
                        this.boat.position.add(result.normal.multiplyScalar(result.penetration));
                        
                        // Sliding response
                        const vDotN = this.boat.physics.velocity.dot(result.normal);
                        if (vDotN < 0) {
                            const vNormal = result.normal.clone().multiplyScalar(vDotN);
                            this.boat.physics.velocity.sub(vNormal);
                            this.boat.physics.velocity.multiplyScalar(0.9); // Friction
                        }
                    }
                }
            }
        });
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
