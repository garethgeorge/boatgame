import * as THREE from 'three';
import { PhysicsEngine } from './core/PhysicsEngine';
import { GraphicsEngine } from './core/GraphicsEngine';
import { SkyManager } from './sky/SkyManager';
import { EntityManager } from './core/EntityManager';
import { TerrainManager } from './world/TerrainManager';
import { TerrainChunk } from './world/TerrainChunk';
import { Decorations } from './world/Decorations';
import { RiverSystem } from './world/RiverSystem';
import { ObstacleManager } from './managers/ObstacleManager';
import { Boat } from './entities/Boat';
import { Alligator } from './entities/obstacles/Alligator';
import { Hippo } from './entities/obstacles/Hippo';
import { InputManager } from './managers/InputManager';
import { Profiler } from './core/Profiler';
import { Entity } from './core/Entity';
import { MessageInABottle } from './entities/obstacles/MessageInABottle';

export class Game {
    container: HTMLElement;
    physicsEngine: PhysicsEngine;
    graphicsEngine: GraphicsEngine;
    skyManager: SkyManager;
    entityManager: EntityManager;
    inputManager: InputManager;
    clock: THREE.Clock;
    isPlaying: boolean = false;

    // UI Elements
    startScreen: HTMLElement;
    startBtn: HTMLElement;
    instructionsOverlay: HTMLElement;
    instructionsContent: HTMLElement;
    scoreElement: HTMLElement;
    thrustElement: HTMLElement;
    fuelElement: HTMLElement;

    boat!: Boat;
    terrainManager!: TerrainManager;
    obstacleManager!: ObstacleManager;

    score: number = 0;
    fuel: number = 100;

    // Game State
    isPaused: boolean = false;
    debugMode: boolean = false;
    viewMode: 'close' | 'far' = 'close';

    constructor() {
        this.container = document.getElementById('game-container') as HTMLElement;

        // Initialize Engines
        this.physicsEngine = new PhysicsEngine();
        this.graphicsEngine = new GraphicsEngine(this.container);
        this.skyManager = new SkyManager(this.graphicsEngine.scene, this.container, this.graphicsEngine.renderer.domElement);
        this.entityManager = new EntityManager(this.physicsEngine, this.graphicsEngine);
        this.inputManager = new InputManager();
        this.clock = new THREE.Clock();

        // UI
        this.startScreen = document.getElementById('start-screen') as HTMLElement;
        this.startBtn = document.getElementById('start-btn') as HTMLElement;
        // Disable start button until initialization is complete
        this.startBtn.style.visibility = 'hidden';

        this.instructionsOverlay = document.getElementById('instructions-overlay') as HTMLElement;
        this.instructionsContent = document.getElementById('instructions-content') as HTMLElement;
        this.scoreElement = document.getElementById('score') as HTMLElement;
        this.thrustElement = document.getElementById('thrust-display') as HTMLElement;
        this.fuelElement = document.getElementById('fuel-display') as HTMLElement;

        this.startBtn.addEventListener('click', async (e) => {
            console.log('[DEBUG] Start button clicked');
            // Prevent event propagation to avoid accidental clicks on subsequently loaded elements
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Request Accelerometer Permission (Mobile)
            console.log('[DEBUG] Requesting permission...');
            await this.inputManager.requestPermission();
            console.log('[DEBUG] Permission granted, calling start()');
            this.start();
        });

        // Check for touch device to update UI text
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            const instructions = document.createElement('p');
            instructions.innerText = "Tap Start to Enable Tilt Controls";
            instructions.style.color = "#aaa";
            instructions.style.fontSize = "14px";
            instructions.style.marginTop = "10px";
            this.startScreen.appendChild(instructions);
        }
    }

    async preload() {
        // Preload all assets here
        await Promise.all([
            Decorations.preload(),
            // Add other entities here as needed
        ]);
    }


    init() {
        // Create World
        // ObstacleManager must be created before TerrainManager now
        this.obstacleManager = new ObstacleManager(this.entityManager, this.physicsEngine);
        this.terrainManager = new TerrainManager(this.physicsEngine, this.graphicsEngine, this.obstacleManager);

        // Wire up interpolation
        this.physicsEngine.onStep = () => {
            this.entityManager.savePreviousState();
        };

        // Create Boat
        this.boat = new Boat(0, 0, this.physicsEngine);
        this.entityManager.add(this.boat);

        // Initial update to generate terrain around boat
        // This will now also trigger obstacle spawning via TerrainManager
        if (this.boat.meshes.length > 0) {
            this.terrainManager.update(this.boat, 0.016);
        }

        // Collision Listener
        this.physicsEngine.world.on('begin-contact', (contact) => {
            const fixtureA = contact.getFixtureA();
            const fixtureB = contact.getFixtureB();
            const bodyA = fixtureA.getBody();
            const bodyB = fixtureB.getBody();
            const userDataA = bodyA.getUserData() as any;
            const userDataB = bodyB.getUserData() as any;

            if (!userDataA || !userDataB) return;

            let player: Boat | null = null;
            let entity: Entity | null = null;
            let entityType: string | null = null;
            let entitySubtype: string | null = null;

            if (userDataA.type === 'player') {
                player = userDataA.entity as Boat;
                entity = userDataB.entity as Entity;
                entityType = userDataB.type;
                entitySubtype = userDataB.subtype;
            } else if (userDataB.type === 'player') {
                player = userDataB.entity as Boat;
                entity = userDataA.entity as Entity;
                entityType = userDataA.type;
                entitySubtype = userDataA.subtype;
            }

            if (player && entity) {
                if (entityType === 'obstacle') {
                    if (entity.canCausePenalty && !entity.hasCausedPenalty) {
                        this.score -= 100;
                        this.boat.flashRed();
                        this.boat.collectedBottles.removeBottle(); // Lose a bottle
                        entity.hasCausedPenalty = true;
                    }
                } else if (entityType === 'collectable') {
                    if (entitySubtype === 'bottle') {
                        const bottle = entity as MessageInABottle;
                        const points = bottle.points;
                        const color = bottle.color;
                        this.score += points;
                        this.boat.collectedBottles.addBottle(color); // Add a bottle
                    }
                }
            }

            // Only call onHit if entity exists
            if (entity) {
                entity.onHit();
            }
        });

        // Enable start button now that we are ready
        this.startBtn.style.visibility = 'visible';
        this.startBtn.style.opacity = '1';

        this.animate();
    }

    start() {
        console.log('[DEBUG] start() called');
        if (!this.boat) return; // Guard against uninitialized start

        console.log('[DEBUG] Hiding start screen');
        this.startScreen.style.display = 'none';

        // need to initialize the game state
        this.isPlaying = true;
        this.update(1 / 60);

        // Show welcome instructions immediately
        console.log('[DEBUG] About to call showInstructions()');
        this.showInstructions('assets/instructions/welcome.html');
        console.log('[DEBUG] showInstructions() returned');
    }

    showInstructions(url: string) {
        console.log('[DEBUG] showInstructions() called with url:', url);
        // 1. Pause immediately synchronously
        this.isPaused = true;
        console.log('[DEBUG] Set isPaused = true');
        this.inputManager.setOptions({ paused: true });
        console.log('[DEBUG] Set inputManager paused = true');
        this.instructionsOverlay.style.display = 'flex';
        console.log('[DEBUG] Set overlay display to flex. Current display:', this.instructionsOverlay.style.display);

        // 2. Load content asynchronously
        console.log('[DEBUG] Calling loadInstructionsContent()');
        this.loadInstructionsContent(url);
    }

    private async loadInstructionsContent(url: string) {
        console.log(`Fetching instructions from: ${url}`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            this.instructionsContent.innerHTML = html;

            // Wire up dismiss button if present in the loaded content
            const dismissBtn = document.getElementById('dismiss-instructions-btn');
            if (dismissBtn) {
                // Track when instructions were shown
                //const instructionsShownTime = Date.now();
                //const MIN_DISPLAY_TIME = 500; // Minimum time in ms before dismiss is allowed

                dismissBtn.addEventListener('click', (e) => {
                    // Prevent event propagation
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    // Only allow dismissal after minimum display time
                    //const elapsedTime = Date.now() - instructionsShownTime;
                    //if (elapsedTime >= MIN_DISPLAY_TIME) {
                    this.dismissInstructions();
                    //} else {
                    //    console.log(`Instructions dismissed too quickly (${elapsedTime}ms). Ignoring.`);
                    //}
                });
            } else {
                console.warn("Dismiss button not found in instructions HTML");
            }

        } catch (e) {
            console.error("Failed to load instructions:", e);
            // Do not auto-dismiss on error, so we can see the overlay (empty) and the error
            // this.dismissInstructions(); 
            this.instructionsContent.innerHTML = `<p style="color:white">Failed to load instructions. <br> ${e}</p> <button id="error-dismiss">Dismiss</button>`;
            const errorDismiss = document.getElementById('error-dismiss');
            if (errorDismiss) errorDismiss.addEventListener('click', () => this.dismissInstructions());
        }
    }

    dismissInstructions() {
        console.log('[DEBUG] dismissInstructions() called');
        console.trace('[DEBUG] Stack trace for dismissInstructions');
        this.instructionsOverlay.style.display = 'none';
        this.instructionsContent.innerHTML = '';
        this.isPaused = false;
        this.inputManager.setOptions({ paused: false });

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.clock.start();
        }
        console.log('[DEBUG] Instructions dismissed, game resuming');
    }

    update(dt: number) {
        if (!this.isPlaying) return;

        // Update Input State
        this.inputManager.update();

        // Handle Global Toggles (Pause, Debug, ViewMode)
        if (this.inputManager.wasPressed('paused')) {
            this.isPaused = !this.isPaused;
            // Prevent default behavior if needed, usually handled in InputManager to stop scrolling
        }

        if (this.inputManager.wasPressed('debug')) {
            this.debugMode = !this.debugMode;
        }

        if (this.inputManager.wasPressed('viewMode')) {
            this.viewMode = this.viewMode === 'close' ? 'far' : 'close';
        }

        if (this.inputManager.wasPressed('skipBiome')) {
            this.skipToNextBiome();
        }

        // Pause handling - skip all updates if paused
        if (this.isPaused) return;

        Profiler.setVisibility(this.debugMode);

        // Update Physics
        Profiler.start('Physics');
        this.physicsEngine.update(dt);
        Profiler.end('Physics');

        // Update Entities (includes syncing physics -> graphics)
        // Update Entities (includes syncing physics -> graphics)
        // We pass input manager directly now
        Profiler.start('Entities');
        this.boat.update(dt, this.inputManager);
        this.entityManager.update(dt);
        Profiler.end('Entities');

        // Update Terrain
        if (this.boat.meshes.length > 0) {
            Profiler.start('Terrain');
            this.terrainManager.setDebug(this.debugMode);
            this.entityManager.setDebug(this.debugMode);
            this.terrainManager.update(this.boat, dt);
            // ObstacleManager update is now handled by TerrainManager events
            Profiler.end('Terrain');
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
        if (this.boat.meshes.length > 0) {
            // Calculate ideal camera position based on boat's rotation
            // We want the camera behind and above the boat.
            // Boat faces -Z (in model space) or whatever direction physics says.
            // Physics angle 0 is usually "up" (-Y in 2D, -Z in 3D world).
            // Let's use the mesh rotation to be safe as it's synced.

            const boatMesh = this.boat.meshes[0];
            const boatPos = boatMesh.position.clone();
            const boatRot = boatMesh.rotation.y;

            // Offset: Behind (positive Z relative to boat facing -Z) and Up (positive Y)
            // If boat faces -Z, "behind" is +Z.

            // Offset: Behind (positive Z relative to boat facing -Z) and Up (positive Y)
            // If boat faces -Z, "behind" is +Z.

            const offsetDistance = this.viewMode === 'far' ? 20 : 7;
            const offsetHeight = this.viewMode === 'far' ? 15 : 3;

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

        // Update Sky
        this.skyManager.update(dt, this.graphicsEngine.camera.position, this.boat);

        // Update Water Shader Uniforms
        if (TerrainChunk.waterMaterial) {
            TerrainChunk.waterMaterial.uniforms.uTime.value += dt;
            TerrainChunk.waterMaterial.uniforms.uSunPosition.value.copy(this.skyManager.getSunPosition());

            // Update Swamp Factor
            const boatZ = this.boat.meshes[0].position.z;
            const mixture = RiverSystem.getInstance().biomeManager.getBiomeMixture(boatZ);
            let swampFactor = 0.0;
            if (mixture.biome1 === 'swamp') swampFactor += mixture.weight1;
            if (mixture.biome2 === 'swamp') swampFactor += mixture.weight2;

            TerrainChunk.waterMaterial.uniforms.uSwampFactor.value = swampFactor;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = this.clock.getDelta();

        this.update(dt);

        // Pass dt to graphics engine for day/night cycle
        Profiler.start('Render');
        this.graphicsEngine.render(dt);
        Profiler.end('Render');

        Profiler.update();
    }

    private skipToNextBiome() {
        if (!this.boat || this.boat.meshes.length === 0) return;

        const riverSystem = RiverSystem.getInstance();
        const BIOME_LENGTH = riverSystem.biomeManager.BIOME_LENGTH;

        const currentZ = this.boat.meshes[0].position.z;

        // Calculate start of next biome
        // We are moving in -Z direction.
        // If z = -500, next is -1000.
        // If z = -1000, next is -2000.
        // Use a small offset so if we are exactly on boundary, we go to next.
        const nextZ = Math.floor(currentZ / BIOME_LENGTH - 0.01) * BIOME_LENGTH;

        // Get center of river at that location
        const nextX = riverSystem.getRiverCenter(nextZ);

        // Teleport boat
        // Move slightly past the boundary to be safe? 
        // User asked for "position of the start of the next biome".
        // Boundary is exact start.
        this.boat.teleport(nextX, nextZ);

        // Force terrain update?
        // TerrainManager.update checks distance, so it should handle it.
        // But might need to jump-start it if the jump is huge.
        // update(boat, dt) should work fine.
    }
}
