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
        this.score = 100;
        
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

        this.updateScore(); // Show initial score
        this.animate();
    }
// ... (skip to collision logic)

    handleCollisionPenalty(deco) {
        // Calculate penalty: Max of 50 or 10% of current score
        const penalty = Math.max(50, Math.floor(this.score * 0.1));
        this.score -= penalty;
        
        if (this.score <= 0) {
            this.score = 0;
            this.gameOver();
        }
        
        this.updateScore();
        this.boat.flashDamage();
        
        // Trigger entity animation (sink/hit)
        if (deco.hit) deco.hit();
    }

    gameOver() {
        this.isPlaying = false;
        alert("Game Over! You ran out of points.");
        location.reload(); // Simple restart for now
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
        const chunks = this.worldManager.riverGenerator.chunks;
        
        chunks.forEach(chunk => {
            if (!chunk.decorations) return;
            
            for (let i = chunk.decorations.length - 1; i >= 0; i--) {
                const deco = chunk.decorations[i];
                
                // Skip if already collected/hit (inactive)
                if (deco.active === false) continue;
                
                // Collectibles
                if (deco.constructor.name === 'Collectible') {
                    // Boat (OBB) vs Collectible (Circle)
                    const result = this.boat.physics.checkOBBvsCircle(
                        this.boat.position,
                        this.boat.size,
                        this.boat.rotation,
                        deco.position,
                        deco.radius
                    );
                    
                    if (result.collided) {
                        // Collected!
                        this.score += deco.points;
                        this.updateScore();
                        
                        // Trigger animation
                        deco.collect();
                    }
                }
                // Obstacles (Log, Crocodile, Tire, BeachBall)
                else if (deco.constructor.name === 'Obstacle') {
                    if (deco.type === 'log' || deco.type === 'crocodile') {
                        // Boat (OBB) vs Obstacle (OBB)
                        const result = this.boat.physics.checkOBBCollision(
                            this.boat.position,
                            this.boat.size,
                            this.boat.rotation,
                            deco.position,
                            deco.size,
                            deco.mesh.rotation.y
                        );
                        
                        if (result.collided) {
                            if (deco.type === 'log') {
                                // Log: Penalty + Sink
                                this.handleCollisionPenalty(deco);
                            } else {
                                // Crocodile: Penalty
                                this.handleCollisionPenalty(deco);
                            }
                        }
                    } else {
                        // Boat (OBB) vs Obstacle (Circle) - Tire, BeachBall
                        const result = this.boat.physics.checkOBBvsCircle(
                            this.boat.position,
                            this.boat.size,
                            this.boat.rotation,
                            deco.position,
                            deco.radius
                        );
                        
                        if (result.collided) {
                            this.handleCollisionPenalty(deco);
                        }
                    }
                }
                // Piers
                else if (deco.constructor.name === 'Pier') {
                    // Boat (OBB) vs Pier (OBB)
                    const center = deco.position.clone().add(
                        deco.centerOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), deco.rotationY)
                    );
                    
                    const result = this.boat.physics.checkOBBCollision(
                        this.boat.position,
                        this.boat.size,
                        this.boat.rotation,
                        center,
                        deco.size,
                        deco.rotationY
                    );
                    
                    if (result.collided) {
                        // Damage on first impact
                        if (!deco.hasCollided) {
                            deco.hasCollided = true;
                            // Calculate penalty manually since Pier doesn't have hit() usually?
                            // Or just use handleCollisionPenalty but ensure hit() exists or is safe.
                            // Pier doesn't have hit(), but handleCollisionPenalty checks if (deco.hit).
                            // So it's safe.
                            
                            const penalty = Math.max(50, Math.floor(this.score * 0.1));
                            this.score -= penalty;
                            
                            if (this.score <= 0) {
                                this.score = 0;
                                this.gameOver();
                            }
                            
                            this.updateScore();
                            this.boat.flashDamage();
                        }

                        // Solid collision (Push & Slide)
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
