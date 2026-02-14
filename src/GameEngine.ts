import * as THREE from 'three';
import * as planck from 'planck';
import { PhysicsEngine } from './core/PhysicsEngine';
import { GraphicsEngine } from './core/GraphicsEngine';
import { SkyManager } from './sky/SkyManager';
import { EntityManager } from './core/EntityManager';
import { TerrainManager } from './world/TerrainManager';
import { InputManager } from './managers/InputManager';
import { Profiler } from './core/Profiler';
import { Boat } from './entities/Boat';
import { Entity } from './entities/Entity';
import { GraphicsUtils } from './core/GraphicsUtils';
import { DebugSettings } from './core/DebugSettings';
import { TerrainChunk } from './world/TerrainChunk';
import { RiverSystem } from './world/RiverSystem';
import { DebugConsole } from './core/DebugConsole';
import { DesignerSettings } from './core/DesignerSettings';
import { BiomeType } from './world/biomes/BiomeType';


export class GameEngine {
    physicsEngine: PhysicsEngine;
    graphicsEngine: GraphicsEngine;
    skyManager: SkyManager;
    entityManager: EntityManager;
    inputManager: InputManager;
    clock: THREE.Clock;

    public onUpdate?: (dt: number) => void;

    boat!: Boat;
    terrainManager!: TerrainManager;

    isPaused: boolean = true;
    timeScale: number = 1.0;
    viewMode: 'close' | 'far' | 'birds' | 'birdsFar' = 'close';

    pendingContacts: Map<Entity, { type: string, subtype: any, boatPart: string }> = new Map();

    constructor(container: HTMLElement) {
        this.physicsEngine = new PhysicsEngine();
        this.graphicsEngine = new GraphicsEngine(container);
        this.skyManager = new SkyManager(this.graphicsEngine.scene, container, this.graphicsEngine.renderer.domElement);
        this.entityManager = new EntityManager(this.physicsEngine, this.graphicsEngine);
        this.inputManager = new InputManager();
        this.clock = new THREE.Clock();
    }

    public init(onReady: () => void) {
        this.terrainManager = new TerrainManager(this.physicsEngine, this.graphicsEngine, this.entityManager);

        this.physicsEngine.onStep = () => {
            this.entityManager.savePreviousState();
        };

        this.boat = new Boat(0, 0, this.physicsEngine);
        this.entityManager.add(this.boat);

        if (this.boat.meshes.length > 0) {
            this.terrainManager.update(this.boat, 0.016);
        }

        this.setupCollisionListener();
        onReady();
    }

    private setupCollisionListener() {
        this.physicsEngine.world.on('begin-contact', (contact) => {
            const fixtureA = contact.getFixtureA();
            const fixtureB = contact.getFixtureB();

            if ((fixtureA.getUserData() as any)?.type === Entity.TYPE_SENSOR ||
                (fixtureB.getUserData() as any)?.type === Entity.TYPE_SENSOR) return;

            const userDataA = fixtureA.getBody().getUserData() as any;
            const userDataB = fixtureB.getBody().getUserData() as any;

            if (!userDataA || !userDataB) return;

            let player: Boat | null = null;
            let entityData = null;
            let boatPart = 'unknown';

            if (userDataA.type === Entity.TYPE_PLAYER) {
                player = userDataA.entity as Boat;
                entityData = userDataB;
                boatPart = (fixtureA.getUserData() as any)?.part || 'unknown';
            } else if (userDataB.type === Entity.TYPE_PLAYER) {
                player = userDataB.entity as Boat;
                entityData = userDataA;
                boatPart = (fixtureB.getUserData() as any)?.part || 'unknown';
            }

            const entity = entityData?.entity as Entity;
            if (!player || !entity) return;

            this.pendingContacts.set(entity, {
                type: entityData!.type,
                subtype: entityData!.subtype,
                boatPart
            });
        });
    }

    public start() {
        console.log('[DEBUG] GameEngine.start() called');
        this.isPaused = false;
        this.clock.start();
    }

    public animate() {
        Profiler.beginFrame();
        requestAnimationFrame(() => this.animate());

        Profiler.start('Update');
        const dt = this.clock.getDelta() * this.timeScale;
        this.update(dt);
        if (this.onUpdate) this.onUpdate(dt);
        Profiler.end('Update');

        Profiler.start('Render');
        this.graphicsEngine.render(dt);
        Profiler.end('Render');
        this.graphicsEngine.updateDebugInfo();

        Profiler.endFrame();
    }

    private update(dt: number) {
        const frameStart = performance.now();

        this.inputManager.update();

        if (this.inputManager.wasPressed('paused')) {
            this.isPaused = !this.isPaused;
            this.inputManager.setOptions({ paused: this.isPaused });
        }

        // Debug sync (logic moved to DebugMenu)
        this.terrainManager.setDebug(DebugSettings.geometryVisible);
        this.entityManager.setDebug(DebugSettings.geometryVisible);

        if (this.inputManager.wasPressed('viewMode')) {
            const modes: ('close' | 'far' | 'birds' | 'birdsFar')[] = ['close', 'far', 'birds', 'birdsFar'];
            const idx = modes.indexOf(this.viewMode);
            this.viewMode = modes[(idx + 1) % modes.length];
        }

        if (this.inputManager.wasPressed('skipBiome')) {
            this.skipToNextBiome();
        }

        Profiler.setVisibility(DebugSettings.profilerVisible);

        if (!this.isPaused) {
            this.processContacts();

            Profiler.start('Entities');
            // 1. Logic Phase (Read-only)
            this.boat.updateLogic(dt, this.inputManager);
            this.entityManager.updateLogic(dt);

            // 2. Apply Phase (Write-intent)
            this.boat.applyUpdate(dt);
            this.entityManager.applyUpdates(dt);
            Profiler.end('Entities');

            // 3. Physics Phase (Advance)
            Profiler.start('Physics');
            this.physicsEngine.update(dt);
            Profiler.end('Physics');
        }

        if (this.boat.meshes.length > 0) {
            // 4. Visuals & Sync Phase (Interpolate & FX)
            const alpha = this.physicsEngine.getAlpha();
            this.entityManager.updateVisuals(dt, alpha);
            this.boat.updateVisuals(dt, alpha);

            Profiler.start('Terrain');
            this.terrainManager.update(this.boat, dt);
            Profiler.end('Terrain');
            this.updateCameraAndVisibility(dt);
        }

        this.skyManager.update(dt, this.graphicsEngine.camera.position, this.boat);

        // Give terrain manager time to initialize chunks that are being created
        const frameEnd = performance.now();
        const elapsed = frameEnd - frameStart;
        const FRAME_BUDGET = 14; // Aim for 14ms total to be safe
        this.terrainManager.generate(Math.max(FRAME_BUDGET - elapsed, 1.0));

        if (TerrainChunk.waterMaterial) {
            TerrainChunk.waterMaterial.uniforms.uTime.value += dt;
            TerrainChunk.waterMaterial.uniforms.uSunPosition.value.copy(this.skyManager.getSunPosition());

            const boatZ = this.boat.meshes[0].position.z;
            const swampFactor = RiverSystem.getInstance().biomeManager.getRiverMaterialSwampFactor(boatZ);
            TerrainChunk.waterMaterial.uniforms.uSwampFactor.value = swampFactor;
        }

        if (DebugSettings.leakCheckEnabled && DebugSettings.nextLeakCheckTime < performance.now()) {
            GraphicsUtils.tracker.checkLeaks(20.0, true, this.graphicsEngine.scene);
            DebugSettings.nextLeakCheckTime = performance.now() + DebugSettings.leakCheckInterval;
        }
    }

    private processContacts() {
        this.pendingContacts.forEach((data, entity) => {
            this.boat.didHitObstacle(entity, data.type, data.subtype, data.boatPart);
        });
        this.pendingContacts.clear();

        for (let c = this.physicsEngine.world.getContactList(); c; c = c.getNext()) {
            if (!c.isTouching()) continue;
            const fixtureA = c.getFixtureA();
            const fixtureB = c.getFixtureB();
            let sensor = null, other = null;
            if ((fixtureA.getUserData() as any)?.type === Entity.TYPE_SENSOR) { sensor = fixtureA; other = fixtureB; }
            else if ((fixtureB.getUserData() as any)?.type === Entity.TYPE_SENSOR) { sensor = fixtureB; other = fixtureA; }
            if (!sensor || !other) continue;
            if ((other.getBody().getUserData() as any)?.type !== Entity.TYPE_PLAYER) continue;

            const sensorOwnerData = sensor.getBody().getUserData() as any;
            if (sensorOwnerData?.entity) {
                this.boat.isInContactWithSensor(sensorOwnerData.entity, sensorOwnerData.type, sensorOwnerData.subtype, sensor);
            }
        }
    }

    private updateCameraAndVisibility(dt: number) {

        // Conditional far plane/skybox for designer
        if (DesignerSettings.isDesignerMode) {
            if (this.graphicsEngine.camera.far !== 5000) {
                this.graphicsEngine.camera.far = 5000;
                this.graphicsEngine.camera.updateProjectionMatrix();
            }
        }

        const boatMesh = this.boat.meshes[0];
        const boatPos = boatMesh.position.clone();
        const boatRot = boatMesh.rotation.y;

        let offsetDistance = 14, offsetHeight = 3;
        if (this.viewMode === 'far') { offsetDistance = 20; offsetHeight = 15; }
        else if (this.viewMode === 'birds') { offsetDistance = 0.5; offsetHeight = 40; }
        else if (this.viewMode === 'birdsFar') { offsetDistance = 0.5; offsetHeight = 300; }

        const idealPosition = new THREE.Vector3(
            boatPos.x + Math.sin(boatRot) * offsetDistance,
            boatPos.y + offsetHeight,
            boatPos.z + Math.cos(boatRot) * offsetDistance
        );

        const p1 = planck.Vec2(boatPos.x, boatPos.z);
        const p2 = planck.Vec2(idealPosition.x, idealPosition.z);
        let minFraction = 1.0;
        this.physicsEngine.world.rayCast(p1, p2, (fixture, point, normal, f) => {
            const body = fixture.getBody();
            if (body.isStatic() && !fixture.isSensor()) {
                minFraction = f;
                return f;
            }
            return -1.0;
        });

        if (minFraction < 1.0) {
            const fullDist = planck.Vec2.distance(p1, p2);
            if (fullDist > 0) {
                const hitDist = fullDist * minFraction;
                const targetDist = Math.max(0, hitDist - 2.0);
                idealPosition.lerp(new THREE.Vector3(boatPos.x, idealPosition.y, boatPos.z), 1.0 - (targetDist / fullDist));
            }
        }

        const t = 1.0 - Math.pow(0.01, dt);
        if (!DesignerSettings.isDesignerMode) {
            this.graphicsEngine.camera.position.lerp(idealPosition, t * 2.0);
            const lookAtPos = boatPos.clone().add(new THREE.Vector3(0, 2, 0));
            this.graphicsEngine.camera.lookAt(lookAtPos);
        }

        const lookAtPos = boatPos.clone().add(new THREE.Vector3(0, 2, 0));

        // Update visibility of entities and chunks, for the way up
        // above view pretend the camera is behind the boat so the visibility
        // logic behavior can be seen
        if (this.viewMode != 'birdsFar') {
            const visPos = this.graphicsEngine.camera.position;
            const visDir = lookAtPos.clone().sub(visPos).normalize();
            this.terrainManager.updateVisibility(visPos, visDir);
            this.entityManager.updateVisibility(visPos, visDir);
        } else {
            const closeDist = 14, closeHeight = 3;
            const visPos = new THREE.Vector3(boatPos.x + Math.sin(boatRot) * closeDist, boatPos.y + closeHeight, boatPos.z + Math.cos(boatRot) * closeDist);
            const visDir = lookAtPos.clone().sub(visPos).normalize();
            this.terrainManager.updateVisibility(visPos, visDir);
            this.entityManager.updateVisibility(visPos, visDir);
        }
    }

    private skipToNextBiome() {
        if (!this.boat || this.boat.meshes.length === 0) return;

        const riverSystem = RiverSystem.getInstance();

        const currentZ = this.boat.meshes[0].position.z;
        const boundaries = riverSystem.biomeManager.getBiomeBoundaries(currentZ - 1.0);
        const nextZ = boundaries.zMin;

        // ensure biomes are loaded from here to the target z
        riverSystem.biomeManager.ensureWindow(nextZ - 100, currentZ + 100);

        const nextX = riverSystem.getRiverCenter(nextZ);
        this.boat.teleport(nextX, nextZ);
    }

    public jumpToBiome(targetType: BiomeType) {
        if (!this.boat || this.boat.meshes.length === 0) return;
        const riverSystem = RiverSystem.getInstance();

        let maxSteps = 30;
        while (maxSteps > 0) {
            const currentZ = this.boat.meshes[0].position.z;

            // Check if we are already in the target biome
            if (riverSystem.biomeManager.getBiomeAt(currentZ).id === targetType) {
                break;
            }
            this.skipToNextBiome();
            maxSteps--;
        }

        const currentZ = this.engineZPos();
        riverSystem.biomeManager.ensureWindow(currentZ - 500, currentZ + 500);
        this.terrainManager.update(this.boat, 0.016);
    }

    private engineZPos(): number {
        return this.boat.meshes[0].position.z;
    }

    public setPaused(paused: boolean) {
        this.isPaused = paused;
        this.inputManager.setOptions({ paused: this.isPaused });
    }
}
