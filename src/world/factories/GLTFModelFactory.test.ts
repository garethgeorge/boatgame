import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GLTFModelFactory } from './GLTFModelFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Mock GLTFLoader
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => {
    return {
        GLTFLoader: class {
            load = vi.fn((path, onLoad) => {
                onLoad({
                    scene: new THREE.Group(),
                    animations: []
                });
            });
        }
    };
});

// Mock SkeletonUtils.clone
vi.mock('three/examples/jsm/utils/SkeletonUtils.js', () => {
    return {
        clone: vi.fn((obj) => obj.clone())
    };
});

describe('GLTFModelFactory Pooling Integration', () => {
    let factory: GLTFModelFactory;

    beforeEach(async () => {
        factory = new GLTFModelFactory('test-path.glb');
        await factory.load();
    });

    it('should return object to pool when GraphicsUtils.disposeObject is called', () => {
        const model = factory.create();

        // Initially, the model has the onDispose hook
        expect(model.userData.onDispose).toBeDefined();

        // Call GraphicsUtils.disposeObject
        GraphicsUtils.disposeObject(model);

        // Fetch again from factory - should be the same instance from pool
        const model2 = factory.create();
        expect(model2).toBe(model);
    });

    it('should reset transform when retrieved from pool', () => {
        const model = factory.create();
        model.position.set(10, 20, 30);
        model.rotation.set(1, 1, 1);
        model.scale.set(2, 2, 2);

        GraphicsUtils.disposeObject(model);

        const model2 = factory.create();
        expect(model2.position.x).toBe(0);
        expect(model2.position.y).toBe(0);
        expect(model2.position.z).toBe(0);
        expect(model2.scale.x).toBe(1);
    });
});
