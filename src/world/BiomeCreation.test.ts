
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as planck from 'planck';
import { TerrainManager } from './TerrainManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { EntityManager } from '../core/EntityManager';
import { RiverSystem } from './RiverSystem';
import { BiomeManager } from './BiomeManager';
import { ProceduralBiomeGenerator } from './ProceduralBiomeGenerator';

// Mock dependencies
const mockPhysicsEngine = {
    world: {
        createBody: vi.fn(() => ({
            createFixture: vi.fn(),
            destroy: vi.fn(),
            getPosition: vi.fn(() => planck.Vec2(0, 0)),
            getAngle: vi.fn(() => 0),
        })),
        destroyBody: vi.fn(),
    }
} as unknown as PhysicsEngine;

const mockGraphicsEngine = {
    add: vi.fn(),
    remove: vi.fn(),
} as unknown as GraphicsEngine;

const mockEntityManager = {
    removeEntitiesInRange: vi.fn(),
} as unknown as EntityManager;

describe('TerrainManager', () => {
    let terrainManager: TerrainManager;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset Singleton if possible or mock it. 
        // RiverSystem is a singleton, so we rely on its existing state or mock getInstance if it was DI.
        // For now, assuming RiverSystem works deterministically.
        try {
            RiverSystem.createInstance(new BiomeManager(new ProceduralBiomeGenerator(), new ProceduralBiomeGenerator()));
        } catch (e) {
            // Instance already exists from another test
        }
        terrainManager = new TerrainManager(mockPhysicsEngine, mockGraphicsEngine, mockEntityManager);
        // Ensure a biome window exists for tests
        RiverSystem.getInstance().biomeManager.ensureWindow(-1000, 1000);
    });

    it('should generate collision bodies around the boat Z position', () => {
        // Access private method via any
        const tm = terrainManager as any;
        const boatZ = 100;

        tm.updateCollision(boatZ);

        expect(tm.collisionSegments.size).toBeGreaterThan(0);
        expect(mockPhysicsEngine.world.createBody).toHaveBeenCalled();
    });

    it('should create debug meshes when debug is enabled', () => {
        const tm = terrainManager as any;
        terrainManager.setDebug(true);

        const boatZ = 200;
        tm.updateCollision(boatZ);

        const allMeshes = Array.from(tm.collisionSegments.values()).flatMap((s: any) => s.meshes);
        expect(allMeshes.length).toBeGreaterThan(0);
        expect(mockGraphicsEngine.add).toHaveBeenCalled(); // Should add meshes to scene
    });

    it('should not create debug meshes when debug is disabled', () => {
        const tm = terrainManager as any;
        terrainManager.setDebug(false);

        const boatZ = 300;
        tm.updateCollision(boatZ);

        const allMeshes = Array.from(tm.collisionSegments.values()).flatMap((s: any) => s.meshes);
        expect(allMeshes.length).toBe(0);
        expect(mockGraphicsEngine.add).not.toHaveBeenCalled(); // Should NOT add meshes
    });

    it('should cleanup old bodies when updating collision', () => {
        const tm = terrainManager as any;

        // specific mock for this test
        const destroyBodyMock = vi.fn();
        tm.physicsEngine.world.destroyBody = destroyBodyMock;

        // Initial update
        tm.updateCollision(100);
        const initialSegments = new Map(tm.collisionSegments);

        // Move far enough to trigger regeneration of some segments and removal of others
        tm.updateCollision(1000);

        expect(destroyBodyMock).toHaveBeenCalled();
        expect(tm.collisionSegments).not.toEqual(initialSegments);
    });

    it('should only create new segments when moving the boat', () => {
        const tm = terrainManager as any;
        const createBodyMock = vi.spyOn(mockPhysicsEngine.world, 'createBody');

        // Initial update
        tm.updateCollision(100);
        const callsAfterFirst = createBodyMock.mock.calls.length;

        // Move boat slightly, but within common window
        tm.updateCollision(105);
        const callsAfterSecond = createBodyMock.mock.calls.length;

        // Only one new step (5 units) should have been added, creating 2 bodies (left and right bank)
        expect(callsAfterSecond - callsAfterFirst).toBe(2);

        // Move boat far - expect original segments to be deleted and many new ones created
        tm.updateCollision(1000);
        expect(tm.collisionSegments.size).toBeGreaterThan(0);
    });
});
