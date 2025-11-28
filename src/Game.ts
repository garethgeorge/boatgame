import * as THREE from 'three';
import { PhysicsEngine } from './core/PhysicsEngine';
import { GraphicsEngine } from './core/GraphicsEngine';
import { EntityManager } from './core/EntityManager';
import { TerrainManager } from './world/TerrainManager';
import { Decorations } from './world/Decorations';
import { ObstacleManager } from './managers/ObstacleManager';
import { Boat } from './entities/Boat';
import { InputManager } from './managers/InputManager';

export class Game {
    container: HTMLElement;
    physicsEngine: PhysicsEngine;
    graphicsEngine: GraphicsEngine;
    entityManager: EntityManager;
    inputManager: InputManager;
    clock: THREE.Clock;
    isPlaying: boolean = false;

    // UI Elements
    startScreen: HTMLElement;
    startBtn: HTMLElement;
    scoreElement: HTMLElement;
    thrustElement: HTMLElement;
    fuelElement: HTMLElement;

    boat!: Boat;
    terrainManager!: TerrainManager;
    obstacleManager!: ObstacleManager;

    score: number = 0;
    fuel: number = 100;

    constructor() {
        this.container = document.getElementById('game-container') as HTMLElement;

        // Initialize Engines
        this.physicsEngine = new PhysicsEngine();
        this.graphicsEngine = new GraphicsEngine(this.container);
        this.entityManager = new EntityManager(this.physicsEngine, this.graphicsEngine);
        this.inputManager = new InputManager();
        this.clock = new THREE.Clock();

        // Initialize procedural generation caches
        Decorations.initCache();

        // UI
        this.startScreen = document.getElementById('start-screen') as HTMLElement;
        this.startBtn = document.getElementById('start-btn') as HTMLElement;
        this.scoreElement = document.getElementById('score') as HTMLElement;
        this.thrustElement = document.getElementById('thrust-display') as HTMLElement;
        this.fuelElement = document.getElementById('fuel-display') as HTMLElement;

        this.startBtn.addEventListener('click', () => this.start());
    }

    init() {
        // Create World
        // ObstacleManager must be created before TerrainManager now
        this.obstacleManager = new ObstacleManager(this.entityManager, this.physicsEngine);
        this.terrainManager = new TerrainManager(this.physicsEngine, this.graphicsEngine, this.obstacleManager);

        // Create Boat
        this.boat = new Boat(0, 0, this.physicsEngine);
        this.entityManager.add(this.boat);

        // Initial update to generate terrain around boat
        // This will now also trigger obstacle spawning via TerrainManager
        this.terrainManager.update(this.boat.mesh.position.z);

        // Collision Listener
        this.physicsEngine.world.on('begin-contact', (contact) => {
            const fixtureA = contact.getFixtureA();
            const fixtureB = contact.getFixtureB();
            const bodyA = fixtureA.getBody();
            const bodyB = fixtureB.getBody();
            const userDataA = bodyA.getUserData() as any;
            const userDataB = bodyB.getUserData() as any;

            if (!userDataA || !userDataB) return;

            let player = null;
            let other = null;

            if (userDataA.type === 'player') {
                player = userDataA.entity;
                other = userDataB;
            } else if (userDataB.type === 'player') {
                player = userDataB.entity;
                other = userDataA;
            }

            if (player && other) {
                if (other.type === 'obstacle') {
                    if (other.subtype === 'alligator' || other.subtype === 'buoy') {
                        if (!other.entity.hasCausedPenalty) {
                            this.score -= 100;
                            this.boat.flashRed();
                            other.entity.hasCausedPenalty = true;
                        }
                        other.entity.onHit();
                    } else if (other.subtype !== 'pier') {
                        other.entity.onHit();
                        // Collision penalty?
                        // Removed fuel penalty. Maybe slow down boat?
                    }
                } else if (other.type === 'collectable') {
                    other.entity.onHit();
                    if (other.subtype === 'bottle') {
                        // Cast to MessageInABottle to access points, default to 100 if missing
                        const points = (other.entity as any).points || 100;
                        this.score += points;
                    }
                }
            }
        });

        this.animate();
    }

    start() {
        this.isPlaying = true;
        this.startScreen.style.display = 'none';
        this.clock.start();
    }

    update(dt: number) {
        if (!this.isPlaying) return;

        const input = this.inputManager.getState();

        // Update Physics
        this.physicsEngine.update(dt);

        // Update Entities (includes syncing physics -> graphics)
        // We pass input to boat manually for now, or we could pass it to all entities
        this.boat.update(dt, input);
        this.entityManager.update(dt);

        // Update Terrain
        if (this.boat.mesh) {
            this.terrainManager.setDebug(input.debug);
            this.terrainManager.update(this.boat.mesh.position.z);
            // ObstacleManager update is now handled by TerrainManager events
        }

        // Update Game State
        // No fuel anymore

        // Update UI
        this.scoreElement.innerText = `Score: ${this.score} `;

        // Update Thrust Display
        if (this.boat) {
            const throttle = this.boat.getThrottle();
            const percentage = Math.round(throttle * 100);
            this.thrustElement.innerText = `Thrust: ${percentage}% `;

            // Color code
            if (percentage > 0) this.thrustElement.style.color = 'white';
            else if (percentage < 0) this.thrustElement.style.color = '#ffaaaa'; // Reddish for reverse
            else this.thrustElement.style.color = '#aaaaaa'; // Grey for neutral
        }

        // Camera Follow
        if (this.boat.mesh) {
            // Calculate ideal camera position based on boat's rotation
            // We want the camera behind and above the boat.
            // Boat faces -Z (in model space) or whatever direction physics says.
            // Physics angle 0 is usually "up" (-Y in 2D, -Z in 3D world).
            // Let's use the mesh rotation to be safe as it's synced.

            const boatPos = this.boat.mesh.position.clone();
            const boatRot = this.boat.mesh.rotation.y;

            // Offset: Behind (positive Z relative to boat facing -Z) and Up (positive Y)
            // If boat faces -Z, "behind" is +Z.

            const viewMode = this.inputManager.keys.viewMode;
            const offsetDistance = viewMode === 'far' ? 20 : 7;
            const offsetHeight = viewMode === 'far' ? 15 : 3;

            // Calculate offset vector based on rotation
            // We want to be 'offsetDistance' units "behind" the boat.
            // If boat rotation Y is 0 (facing -Z), we want to be at +Z.
            // x = sin(angle) * dist
            // z = cos(angle) * dist

            const offsetX = Math.sin(boatRot) * offsetDistance;
            const offsetZ = Math.cos(boatRot) * offsetDistance;

            const idealPosition = new THREE.Vector3(
                boatPos.x + offsetX,
                boatPos.y + offsetHeight,
                boatPos.z + offsetZ
            );

            // Smoothly interpolate current camera position to ideal position (Spring effect)
            // Lower factor = looser spring, Higher factor = tighter spring
            const t = 1.0 - Math.pow(0.01, dt); // Time-independent lerp factor
            this.graphicsEngine.camera.position.lerp(idealPosition, t * 2.0); // Adjust speed as needed

            // Look at the boat (or slightly ahead)
            const lookAtPos = boatPos.clone().add(new THREE.Vector3(0, 2, 0)); // Look slightly above center
            this.graphicsEngine.camera.lookAt(lookAtPos);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = this.clock.getDelta();

        this.update(dt);

        // Pass dt to graphics engine for day/night cycle
        // Only advance time if playing? Or always? 
        // Let's advance it always for ambience, or only when playing. 
        // User said "every 30 real world minutes". 
        // If we want it to match real world time passing, we should pass dt always.
        this.graphicsEngine.render(dt);
    }
}
