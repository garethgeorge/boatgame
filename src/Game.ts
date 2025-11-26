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
            // Calculate ideal camera position based on boat's rotation
            // We want the camera behind and above the boat.
            // Boat faces -Z (in model space) or whatever direction physics says.
            // Physics angle 0 is usually "up" (-Y in 2D, -Z in 3D world).
            // Let's use the mesh rotation to be safe as it's synced.

            const boatPos = this.boat.mesh.position.clone();
            const boatRot = this.boat.mesh.rotation.y;

            // Offset: Behind (positive Z relative to boat facing -Z) and Up (positive Y)
            // If boat faces -Z, "behind" is +Z.
            const offsetDistance = 20;
            const offsetHeight = 15;

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
        this.update();
        this.graphicsEngine.render();
    }
}
