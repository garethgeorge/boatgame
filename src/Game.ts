import * as THREE from 'three';
import { PhysicsEngine } from './core/PhysicsEngine';
import { GraphicsEngine } from './core/GraphicsEngine';
import { EntityManager } from './core/EntityManager';
import { TerrainManager } from './world/TerrainManager';
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

    boat!: Boat;
    terrainManager!: TerrainManager;

    constructor() {
        this.container = document.getElementById('game-container') as HTMLElement;

        // Initialize Engines
        this.physicsEngine = new PhysicsEngine();
        this.graphicsEngine = new GraphicsEngine(this.container);
        this.entityManager = new EntityManager(this.physicsEngine, this.graphicsEngine);
        this.inputManager = new InputManager();
        this.clock = new THREE.Clock();

        // UI
        this.startScreen = document.getElementById('start-screen') as HTMLElement;
        this.startBtn = document.getElementById('start-btn') as HTMLElement;
        this.scoreElement = document.getElementById('score') as HTMLElement;
        this.thrustElement = document.getElementById('thrust-display') as HTMLElement;

        this.startBtn.addEventListener('click', () => this.start());
    }

    init() {
        // Create World
        this.terrainManager = new TerrainManager(this.physicsEngine, this.graphicsEngine);

        // Create Boat
        this.boat = new Boat(0, 0, this.physicsEngine);
        this.entityManager.add(this.boat);

        // Initial update to generate terrain around boat
        this.terrainManager.update(this.boat.mesh.position.z); // Use mesh position as it's synced with physics

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
            this.terrainManager.update(this.boat.mesh.position.z);
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
