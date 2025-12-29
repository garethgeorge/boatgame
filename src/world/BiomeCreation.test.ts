
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as planck from 'planck';
import { TerrainManager } from './TerrainManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { ObstacleManager } from '../managers/ObstacleManager';
import { RiverSystem } from './RiverSystem';

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

const mockObstacleManager = {
    spawnObstaclesForChunk: vi.fn(),
    removeInRange: vi.fn(),
} as unknown as ObstacleManager;

describe('TerrainManager', () => {
    let terrainManager: TerrainManager;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset Singleton if possible or mock it. 
        // RiverSystem is a singleton, so we rely on its existing state or mock getInstance if it was DI.
        // For now, assuming RiverSystem works deterministically.
        terrainManager = new TerrainManager(mockPhysicsEngine, mockGraphicsEngine, mockObstacleManager);
    });

    it('should generate collision bodies around the boat Z position', () => {
        // Access private method via any
        const tm = terrainManager as any;
        const boatZ = 100;

        tm.updateCollision(boatZ);

        expect(tm.collisionBodies.length).toBeGreaterThan(0);
        expect(mockPhysicsEngine.world.createBody).toHaveBeenCalled();
    });

    it('should create debug meshes when debug is enabled', () => {
        const tm = terrainManager as any;
        terrainManager.setDebug(true);

        const boatZ = 200;
        tm.updateCollision(boatZ);

        expect(tm.collisionMeshes.length).toBeGreaterThan(0);
        expect(mockGraphicsEngine.add).toHaveBeenCalled(); // Should add meshes to scene
    });

    it('should not create debug meshes when debug is disabled', () => {
        const tm = terrainManager as any;
        terrainManager.setDebug(false);

        const boatZ = 300;
        tm.updateCollision(boatZ);

        expect(tm.collisionMeshes.length).toBe(0);
        expect(mockGraphicsEngine.add).not.toHaveBeenCalled(); // Should NOT add meshes
    });

    it('should cleanup old bodies when updating collision', () => {
        const tm = terrainManager as any;

        // specific mock for this test
        const destroyBodyMock = vi.fn();
        tm.physicsEngine.world.destroyBody = destroyBodyMock;

        // Initial update
        tm.updateCollision(100);
        const initialBodies = [...tm.collisionBodies];

        // Move far enough to trigger regeneration
        tm.updateCollision(1000);

        expect(destroyBodyMock).toHaveBeenCalled();
        expect(tm.collisionBodies).not.toEqual(initialBodies);
    });
});
