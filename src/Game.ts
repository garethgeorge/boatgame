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
import { GameThrottle } from './GameThrottle';
import { InputManager } from './managers/InputManager';
import { Profiler } from './core/Profiler';
import { Entity } from './core/Entity';
import { MessageInABottle } from './entities/obstacles/MessageInABottle';
import { Fixture } from 'planck';
import { GraphicsUtils } from './core/GraphicsUtils';
import { Mangrove } from './entities/obstacles/Mangrove';

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
    gameThrottle: GameThrottle;
    fuelElement: HTMLElement;

    boat!: Boat;
    terrainManager!: TerrainManager;
    obstacleManager!: ObstacleManager;

    // Game State
    isPaused: boolean = false;
    debugMode: boolean = false;
    profilerVisible: boolean = false;
    viewMode: 'close' | 'far' = 'close';

    // Collision Handling
    pendingContacts: Map<Entity, { type: string, subtype: any }> = new Map();

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

        this.scoreElement = document.getElementById('score') as HTMLElement;

        this.gameThrottle = new GameThrottle(
            'throttle-container',
            'throttle-thumb',
            (val) => { if (this.boat) this.boat.setThrottle(val); },
            () => this.boat ? this.boat.getThrottle() : 0,
            () => this.isPaused
        );

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
        GraphicsUtils.tracker.verbose = false;
        await Promise.all([
            Decorations.preload(),
            Mangrove.preload(),
            // Add other entities here as needed
        ]);
        //GraphicsUtils.tracker.verbose = true;
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

            // Ignore sensor contacts for collision handling
            if ((fixtureA.getUserData() as any)?.type === 'sensor' ||
                (fixtureB.getUserData() as any)?.type === 'sensor') return;

            const bodyA = fixtureA.getBody();
            const bodyB = fixtureB.getBody();
            const userDataA = bodyA.getUserData() as any;
            const userDataB = bodyB.getUserData() as any;

            if (!userDataA || !userDataB) return;

            let player: Boat | null = null;
            let entityData = null;

            if (userDataA.type === 'player') {
                player = userDataA.entity as Boat;
                entityData = userDataB;
            } else if (userDataB.type === 'player') {
                player = userDataB.entity as Boat;
                entityData = userDataA;
            }

            const entity = userDataB.entity as Entity;
            const entityType = userDataB.type;
            const entitySubtype = userDataB.subtype;

            if (!player || !entity) return;

            // Store contact for processing in next update loop
            this.pendingContacts.set(entity, { type: entityType!, subtype: entitySubtype });
        });

        // Enable start button now that we are ready
        this.startBtn.style.visibility = 'visible';
        this.startBtn.style.opacity = '1';

        this.animate();
    }

    start() {
        console.log('[DEBUG] start() called. Game Instance ID:', Math.random());
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

        // Process deferred contacts
        this.processContacts();

        // Update Input State
        this.inputManager.update();

        // Handle Global Toggles (Pause, Debug, ViewMode)
        if (this.inputManager.wasPressed('paused')) {
            this.isPaused = !this.isPaused;
        }

        if (this.inputManager.wasPressed('debug')) {
            if (this.debugMode) {
                this.debugMode = false;
                this.profilerVisible = false;
            } else {
                this.debugMode = true;
                this.profilerVisible = true;
            }
            this.terrainManager.setDebug(this.debugMode);
            this.entityManager.setDebug(this.debugMode);
        }

        if (this.inputManager.wasPressed('debugProfiler')) {
            if (this.profilerVisible && !this.debugMode) {
                this.profilerVisible = false;
            } else {
                this.profilerVisible = true;
                this.debugMode = false;
            }
            this.terrainManager.setDebug(this.debugMode);
            this.entityManager.setDebug(this.debugMode);
        }

        if (this.inputManager.wasPressed('viewMode')) {
            this.viewMode = this.viewMode === 'close' ? 'far' : 'close';
        }

        if (this.inputManager.wasPressed('skipBiome')) {
            this.skipToNextBiome();
        }

        Profiler.setVisibility(this.profilerVisible);

        // Pause handling - skip all updates if paused
        if (this.isPaused) return;

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
            this.terrainManager.update(this.boat, dt);
            // ObstacleManager update is now handled by TerrainManager events
            Profiler.end('Terrain');
        }

        // Update Game State
        // No fuel anymore

        // Update UI
        this.scoreElement.innerText = `Score: ${this.boat.score} `;

        // Update Thrust Display
        if (this.boat) {
            this.gameThrottle.updateVisuals(this.boat.getThrottle());
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
            const swampFactor = RiverSystem.getInstance().biomeManager.getRiverMaterialSwampFactor(boatZ);
            TerrainChunk.waterMaterial.uniforms.uSwampFactor.value = swampFactor;
        }
    }

    animate() {
        Profiler.beginFrame();

        requestAnimationFrame(() => this.animate());

        const dt = this.clock.getDelta();

        this.update(dt);

        // Pass dt to graphics engine for day/night cycle
        Profiler.start('Render');
        this.graphicsEngine.render(dt);
        Profiler.end('Render');
        this.graphicsEngine.updateDebugInfo();

        Profiler.endFrame();
    }

    private skipToNextBiome() {
        if (!this.boat || this.boat.meshes.length === 0) return;

        const riverSystem = RiverSystem.getInstance();
        const biomeLength = riverSystem.biomeManager.BIOME_LENGTH;

        const currentZ = this.boat.meshes[0].position.z;

        // Calculate start of next biome
        // We are moving in -Z direction.
        // If z = -500, next is -1000.
        // If z = -1000, next is -2000.
        // Use a small offset so if we are exactly on boundary, we go to next.
        const nextZ = Math.floor(currentZ / biomeLength - 0.01) * biomeLength;

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

    private processContacts() {

        // Process the pending contact events
        this.pendingContacts.forEach((data, entity) => {
            const { type, subtype } = data;
            entity.wasHitByPlayer(this.boat);
            this.boat.didHitObstacle(entity, type, subtype);
        });

        this.pendingContacts.clear();

        // Process sensor contacts
        for (let c = this.physicsEngine.world.getContactList(); c; c = c.getNext()) {
            if (!c.isTouching()) continue;

            const fixtureA = c.getFixtureA();
            const fixtureB = c.getFixtureB();

            let sensor: Fixture | null = null;
            let other: Fixture | null = null;

            // Check UserData for sensor tag
            const dataA = fixtureA.getUserData() as any;
            const dataB = fixtureB.getUserData() as any;

            if (dataA?.type === 'sensor') {
                sensor = fixtureA;
                other = fixtureB;
            } else if (dataB?.type === 'sensor') {
                sensor = fixtureB;
                other = fixtureA;
            }

            if (!sensor || !other) continue;

            // Check if interaction involves player
            const otherBody = other.getBody();
            const otherData = otherBody.getUserData() as any;
            if (otherData?.type !== 'player') continue;

            // Get sensor owner entity
            const sensorBody = sensor.getBody();
            const sensorOwnerData = sensorBody.getUserData() as any;

            if (sensorOwnerData && sensorOwnerData.entity) {
                this.boat.isInContactWithSensor(
                    sensorOwnerData.entity,
                    sensorOwnerData.type,
                    sensorOwnerData.subtype,
                    sensor
                );
            }
        }
    }
}

