import { Engine, Vector3, MeshBuilder, StandardMaterial, Color3, PointLight, HemisphericLight, TransformNode, Quaternion } from '@babylonjs/core';
import { PhysicsEngine } from './core/PhysicsEngine';
import { GraphicsEngine } from './core/GraphicsEngine';
import { SkyManager } from './sky/SkyManager';
import { EntityManager } from './core/EntityManager';
import { TerrainManager } from './world/TerrainManager';
import { ObstacleManager } from './managers/ObstacleManager';
import { Boat } from './entities/Boat';
import { GameThrottle } from './GameThrottle';
import { InputManager } from './managers/InputManager';
import { TerrainChunk } from './world/TerrainChunk';
import { Decorations } from './world/Decorations';
import { RiverSystem } from './world/RiverSystem';
import { Profiler } from './core/Profiler';
import { Entity } from './core/Entity';
import { Fixture } from 'planck';

export class Game {
    private container: HTMLElement;
    private physicsEngine: PhysicsEngine;
    private graphicsEngine: GraphicsEngine;
    private skyManager: SkyManager;
    private entityManager: EntityManager;
    private inputManager: InputManager;
    private obstacleManager!: ObstacleManager;
    private terrainManager!: TerrainManager;
    private boat!: Boat;

    // Dummy boat for Phase 2 Verification
    // private dummyBoat: any;

    private lastTime: number = 0;
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private debugMode: boolean = false;

    // UI Elements
    private startScreen: HTMLElement;
    private startBtn: HTMLElement;
    private instructionsOverlay: HTMLElement;
    private instructionsContent: HTMLElement;
    private scoreElement: HTMLElement;
    private gameThrottle: GameThrottle;
    private fuelElement: HTMLElement;

    constructor() {
        this.container = document.getElementById('game-container') as HTMLElement;
        this.physicsEngine = new PhysicsEngine();
        this.graphicsEngine = new GraphicsEngine(this.container);
        this.entityManager = new EntityManager(this.physicsEngine, this.graphicsEngine);
        this.inputManager = new InputManager();

        // UI
        this.startScreen = document.getElementById('start-screen') as HTMLElement;
        this.startBtn = document.getElementById('start-btn') as HTMLElement;
        this.startBtn.style.visibility = 'hidden';

        this.instructionsOverlay = document.getElementById('instructions-overlay') as HTMLElement;
        this.instructionsContent = document.getElementById('instructions-content') as HTMLElement;
        this.scoreElement = document.getElementById('score') as HTMLElement;

        this.gameThrottle = new GameThrottle(
            'throttle-container',
            'throttle-thumb',
            (val) => {
                if (this.boat) this.boat.setThrottle(val);
            },
            () => 0,
            () => this.isPaused
        );

        this.fuelElement = document.getElementById('fuel-display') as HTMLElement;

        this.startBtn.addEventListener('click', async (e) => {
            console.log('[DEBUG] Start button clicked');
            e.stopPropagation();
            e.stopImmediatePropagation();

            console.log('[DEBUG] Requesting permission...');
            await this.inputManager.requestPermission();
            console.log('[DEBUG] Permission granted, calling start()');
            this.start();
        });

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
        console.log("Preloading assets...");
    }

    async init() {
        // Initialize Graphics Engine (Async WebGPU)
        await this.graphicsEngine.init();

        // Sky Setup (must be after graphicsEngine.init to have scene)
        const canvas = this.graphicsEngine.engine.getRenderingCanvas();
        this.skyManager = new SkyManager(this.graphicsEngine.scene, this.container, canvas as HTMLCanvasElement);

        // Preload Assets (requires Scene to be initialized)
        await Decorations.preload();

        // World Managers
        this.obstacleManager = new ObstacleManager(this.entityManager, this.physicsEngine);
        this.terrainManager = new TerrainManager(this.physicsEngine, this.graphicsEngine, this.obstacleManager);

        this.physicsEngine.onStep = () => {
            this.entityManager.savePreviousState();
        };

        // Create Player Boat
        this.boat = new Boat(0, 0, this.physicsEngine);
        this.entityManager.add(this.boat);

        // Camera
        if (this.boat.meshes.length > 0) {
            this.graphicsEngine.camera.setTarget(this.boat.meshes[0].position);
        }

        // Light
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.graphicsEngine.scene);
        hemiLight.intensity = 1.0;

        const light = new PointLight("pointLight", new Vector3(0, 50, 0), this.graphicsEngine.scene);
        light.intensity = 0.5;

        // Enable start button
        this.startBtn.style.visibility = 'visible';
        this.startBtn.style.opacity = '1';

        // Start render loop
        this.animate();

        // Initial terrain update
        this.terrainManager.update(this.boat, 0);
    }

    start() {
        if (!this.graphicsEngine) return;

        this.startScreen.style.display = 'none';
        this.isPlaying = true;

        // this.showInstructions('assets/instructions/welcome.html');
    }

    showInstructions(url: string) {
        this.isPaused = true;
        this.inputManager.setOptions({ paused: true });
        this.instructionsOverlay.style.display = 'flex';
        this.loadInstructionsContent(url);
    }

    private async loadInstructionsContent(url: string) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            this.instructionsContent.innerHTML = html;

            const dismissBtn = document.getElementById('dismiss-instructions-btn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.dismissInstructions();
                });
            }
        } catch (e) {
            console.error("Failed to load instructions:", e);
            this.dismissInstructions();
        }
    }

    dismissInstructions() {
        this.instructionsOverlay.style.display = 'none';
        this.instructionsContent.innerHTML = '';
        this.isPaused = false;
        this.inputManager.setOptions({ paused: false });
        this.isPlaying = true;
    }

    update(dt: number) {
        if (!this.isPlaying || this.isPaused) return;

        // this.processContacts();
        this.inputManager.update();

        // Toggles
        if (this.inputManager.wasPressed('paused')) {
            this.isPaused = !this.isPaused;
        }

        if (this.inputManager.wasPressed('debug')) {
            this.debugMode = !this.debugMode;
            this.terrainManager.setDebug(this.debugMode);
            this.entityManager.setDebug(this.debugMode);
        }

        if (this.inputManager.wasPressed('skipBiome')) {
            console.log("Skipping biome...");
            const boatZ = this.boat.meshes[0].position.z;
            const nextBiomeZ = RiverSystem.getInstance().biomeManager.getNextBiomeStart(boatZ);
            this.boat.teleport(RiverSystem.getInstance().getRiverCenter(nextBiomeZ), nextBiomeZ);
        }

        Profiler.setVisibility(this.debugMode);

        // Physics
        Profiler.start('Physics');
        this.physicsEngine.update(dt);
        Profiler.end('Physics');

        // Entities
        Profiler.start('Entities');
        if (this.boat) this.boat.update(dt, this.inputManager);
        this.entityManager.update(dt);
        Profiler.end('Entities');

        // Terrain
        Profiler.start('Terrain');

        // Camera follow
        if (this.boat && this.boat.meshes.length > 0) {
            const boatMesh = this.boat.meshes[0];
            const boatPos = boatMesh.position;
            const boatRot = boatMesh.rotation.y;

            // Target position calculation
            const offsetDistance = 18; // Closer (was 30)
            const offsetHeight = 6;    // Lower (was 20) for "more first person POV"

            // Physics/Boat coordinate system check:
            // Boat faces -Z usually in this game setup?
            // If camera is at z + offset, it is behind.

            const targetPosition = new Vector3(
                boatPos.x,
                boatPos.y + offsetHeight,
                boatPos.z + offsetDistance
            );

            // Smoothing
            // t = 1.0 - Math.pow(0.01, dt)
            const t = 1.0 - Math.pow(0.01, dt);

            this.graphicsEngine.camera.position = Vector3.Lerp(
                this.graphicsEngine.camera.position,
                targetPosition,
                t * 2.0
            );

            // Look at logic
            const lookAtTarget = boatPos.clone().add(new Vector3(0, 2, 0));
            this.graphicsEngine.camera.setTarget(lookAtTarget);

            // Update Sky
            this.skyManager.update(dt, this.graphicsEngine.camera.position, this.boat);

            // Update Water Material
            if (TerrainChunk.waterMaterial) {
                const currentTime = (TerrainChunk.waterMaterial as any)._uTime || 0;
                const nextTime = currentTime + dt;
                (TerrainChunk.waterMaterial as any)._uTime = nextTime;
                TerrainChunk.waterMaterial.setFloat("uTime", nextTime);
                TerrainChunk.waterMaterial.setVector3("uSunPosition", this.skyManager.getSunPosition());

                // Update Swamp Factor
                const boatZ = this.boat.meshes[0].position.z;
                const swampFactor = RiverSystem.getInstance().biomeManager.getRiverMaterialSwampFactor(boatZ);
                TerrainChunk.waterMaterial.setFloat("uSwampFactor", swampFactor);
            }

            this.terrainManager.update(this.boat, dt);

            // Sync Throttle UI
            this.gameThrottle.updateVisuals(this.boat.getThrottle());
        }

        Profiler.end('Terrain');

        this.scoreElement.innerText = `Score: ${this.boat ? this.boat.score : 0}`;
    }

    animate() {
        this.graphicsEngine.engine.runRenderLoop(() => {
            Profiler.beginFrame();

            const now = performance.now();
            const dt = Math.min((now - this.lastTime) / 1000, 0.1);
            this.lastTime = now;

            if (this.isPlaying) {
                this.update(dt);
            }

            Profiler.start('Render');
            this.graphicsEngine.render(dt);
            Profiler.end('Render');

            this.graphicsEngine.updateDebugInfo();
            Profiler.endFrame();
        });
    }

    private processContacts() {
        // Contact logic
    }
}
