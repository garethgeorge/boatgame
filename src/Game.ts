import * as THREE from 'three';
import { PhysicsEngine } from './core/PhysicsEngine';
import { GraphicsEngine } from './core/GraphicsEngine';
import { EntityManager } from './core/EntityManager';
import { RiverSystem } from './world/procgen/RiverSystem';
import { TerrainGenerator } from './world/procgen/TerrainGenerator';
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

    riverSystem: RiverSystem;
    terrainGenerator: TerrainGenerator;

    constructor() {
        this.container = document.getElementById('game-container') as HTMLElement;

        // Initialize Engines
        this.physicsEngine = new PhysicsEngine();
        this.graphicsEngine = new GraphicsEngine(this.container);
        this.entityManager = new EntityManager(this.physicsEngine, this.graphicsEngine);
        this.inputManager = new InputManager();
        this.clock = new THREE.Clock();

        // Procedural Generation
        this.riverSystem = new RiverSystem();
        this.terrainGenerator = new TerrainGenerator(this.riverSystem);

        // UI
        this.startScreen = document.getElementById('start-screen') as HTMLElement;
        this.startBtn = document.getElementById('start-btn') as HTMLElement;
        this.scoreElement = document.getElementById('score') as HTMLElement;
        this.thrustElement = document.getElementById('thrust-display') as HTMLElement;

        this.startBtn.addEventListener('click', () => this.start());
    }

    init() {
        // Initial Generation
        this.updateTerrain();

        // Create Boat
        this.boat = new Boat(0, 0);
        this.entityManager.add(this.boat);

        this.animate();
    }

    updateTerrain() {
        // Update River System
        const playerPos = this.boat ? this.boat.position : new THREE.Vector3(0, 0, 0);
        this.riverSystem.update(playerPos);

        // Generate Meshes and Collision for new segments
        for (const seg of this.riverSystem.segments) {
            if (seg.active && !seg.mesh) {
                // Generate Mesh
                seg.mesh = this.terrainGenerator.generateMesh(seg);
                this.graphicsEngine.add(seg.mesh);

                // Generate Collision
                seg.colliderBodies = this.terrainGenerator.generateCollision(seg);
                seg.colliderBodies.forEach(body => this.physicsEngine.addBody(body));
            } else if (!seg.active && seg.mesh) {
                // Remove Mesh
                this.graphicsEngine.remove(seg.mesh);
                seg.mesh.geometry.dispose();
                (seg.mesh.material as THREE.Material).dispose();
                seg.mesh = null;

                // Remove Collision
                seg.colliderBodies.forEach(body => this.physicsEngine.removeBody(body));
                seg.colliderBodies = [];
            }
        }
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

        // Update Physics
        this.physicsEngine.update(dt);

        // Update Entities (includes syncing physics -> graphics)
        // We pass input to boat manually for now, or we could pass it to all entities
        this.boat.update(dt, input);
        this.entityManager.update(dt);

        // Update Terrain (Procedural Generation)
        this.updateTerrain();

        // Camera Follow
        if (this.boat.mesh) {
            const idealOffset = new THREE.Vector3(0, 20, -20); // Higher and further back
            // We can rotate offset based on boat rotation if we want 3rd person, 
            // or keep it fixed for top-down. User asked for top-down-ish?
            // "The world segments should also be objects which have custom bounding boxes... render these boxes in 3d"
            // Let's do a follow cam.

            // Simple follow:
            const targetPos = this.boat.mesh.position.clone();
            targetPos.y = 0; // Look at water level

            this.graphicsEngine.camera.position.lerp(
                targetPos.clone().add(new THREE.Vector3(0, 30, 20)),
                dt * 2.0
            );
            this.graphicsEngine.camera.lookAt(targetPos);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.graphicsEngine.render();
    }
}
