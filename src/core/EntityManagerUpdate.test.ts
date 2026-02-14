import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../entities/Entity';
import { EntityManager } from './EntityManager';
import { PhysicsEngine } from './PhysicsEngine';
import * as THREE from 'three';

class MockEntity extends Entity {
    public constructor() {
        super();
        const mesh = new THREE.Group();
        this.meshes.push(mesh);
    }

    public updateCount = 0;
    public applyCount = 0;
    public visualsCount = 0;

    public updateLogic(dt: number) {
        this.updateCount++;
    }

    public applyUpdate(dt: number) {
        this.applyCount++;
        super.applyUpdate(dt);
    }

    public updateVisuals(dt: number, alpha: number) {
        this.visualsCount++;
        super.updateVisuals(dt, alpha);
    }
}

describe('EntityManager Hierarchical Update', () => {
    let entityManager: EntityManager;
    let physicsEngine: PhysicsEngine;

    beforeEach(() => {
        const mockGraphicsEngine = {
            add: vi.fn(),
            remove: vi.fn()
        };
        physicsEngine = {
            getAlpha: () => 0.5,
            world: {
                createBody: vi.fn().mockReturnValue({
                    createFixture: vi.fn(),
                    setUserData: vi.fn(),
                    getType: () => 'dynamic',
                    getPosition: () => ({ x: 0, y: 0 }),
                    getAngle: () => 0
                })
            }
        } as any;
        entityManager = new EntityManager(physicsEngine as any, mockGraphicsEngine as any);
    });

    it('should call update and applyUpdate on all entities', () => {
        const entity1 = new MockEntity();
        const entity2 = new MockEntity();
        entityManager.add(entity1);
        entityManager.add(entity2);

        entityManager.updateLogic(0.1);
        entityManager.applyUpdates(0.1);

        expect(entity1.updateCount).toBe(1);
        expect(entity1.applyCount).toBe(1);
        expect(entity2.updateCount).toBe(1);
        expect(entity2.applyCount).toBe(1);
    });

    it('should update parents before children in the apply pass', () => {
        const parent = new MockEntity();
        const child = new MockEntity();

        parent.isVisible = true;
        child.isVisible = true;

        const callOrder: string[] = [];

        vi.spyOn(parent, 'applyUpdate').mockImplementation(() => { callOrder.push('parent_apply'); });
        vi.spyOn(parent, 'updateVisuals').mockImplementation(() => { callOrder.push('parent_visuals'); });
        vi.spyOn(child, 'applyUpdate').mockImplementation(() => { callOrder.push('child_apply'); });
        vi.spyOn(child, 'updateVisuals').mockImplementation(() => { callOrder.push('child_visuals'); });

        entityManager.add(parent);
        entityManager.add(child);
        parent.addChild(child);

        // Clear initial syncs from add()
        callOrder.length = 0;

        entityManager.updateLogic(0.1);
        entityManager.applyUpdates(0.1);
        entityManager.updateVisuals(0.1, 0.5);

        expect(callOrder).toEqual([
            'parent_apply',
            'child_apply',
            'parent_visuals',
            'child_visuals'
        ]);
    });

    it('should correctly handle multiple children and deep hierarchies', () => {
        const root = new MockEntity();
        const mid = new MockEntity();
        const leaf = new MockEntity();

        root.isVisible = true;
        mid.isVisible = true;
        leaf.isVisible = true;

        entityManager.add(root);
        entityManager.add(mid);
        entityManager.add(leaf);

        root.addChild(mid);
        mid.addChild(leaf);

        const callOrder: string[] = [];
        vi.spyOn(root, 'updateVisuals').mockImplementation(() => { callOrder.push('root'); });
        vi.spyOn(mid, 'updateVisuals').mockImplementation(() => { callOrder.push('mid'); });
        vi.spyOn(leaf, 'updateVisuals').mockImplementation(() => { callOrder.push('leaf'); });

        // Clear initial syncs from add()
        callOrder.length = 0;

        entityManager.updateVisuals(0.1, 0.5);

        expect(callOrder).toEqual(['root', 'mid', 'leaf']);
    });
});
