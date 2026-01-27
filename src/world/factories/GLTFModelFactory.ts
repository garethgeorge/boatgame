import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { ObjectPool } from '../../core/ObjectPool';

interface GLTFModelData {
    model: THREE.Group | null;
    animations: THREE.AnimationClip[];
}

export class GLTFModelFactory implements DecorationFactory {
    private cache: GLTFModelData = { model: null, animations: [] };
    private path: string;
    private pool: ObjectPool<THREE.Group> | null = null;
    private loadingPromise: Promise<void> | null = null;

    constructor(path: string) {
        this.path = path;
    }

    async load(): Promise<void> {
        if (this.cache.model) return Promise.resolve();
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(this.path, (gltf) => {
                const model = gltf.scene;
                GraphicsUtils.registerObject(model);
                GraphicsUtils.toonify(model);
                GraphicsUtils.markAsCache(model);
                this.cache.model = model;
                this.cache.animations = gltf.animations || [];

                // Initialize pool after model is loaded
                if (!this.pool) {
                    this.pool = new ObjectPool<THREE.Group>(() => {
                        const clonedModel = SkeletonUtils.clone(this.cache.model!) as THREE.Group;
                        GraphicsUtils.registerObject(clonedModel);
                        GraphicsUtils.markAsCache(clonedModel);

                        // Add disposal hook to return to pool
                        clonedModel.userData.onDispose = (obj: THREE.Group) => {
                            this.release(obj);
                        };

                        return clonedModel;
                    });
                }

                this.loadingPromise = null;
                resolve();
            }, undefined, (error) => {
                console.error(`An error occurred loading model ${this.path}:`, error);
                this.loadingPromise = null;
                resolve(); // Resolve anyway to avoid blocking everything
            });
        });

        return this.loadingPromise;
    }

    create(): THREE.Group {
        if (!this.pool) {
            console.warn(`Model ${this.path} not loaded yet`);
            throw new Error(`Model ${this.path} not loaded yet`);
        }

        const model = this.pool.get();
        // Reset transform
        model.position.set(0, 0, 0);
        model.rotation.set(0, 0, 0);
        model.scale.set(1, 1, 1);
        model.quaternion.set(0, 0, 0, 1);

        return model;
    }

    release(obj: THREE.Group): void {
        if (obj.parent) {
            obj.parent.remove(obj);
        }
        if (this.pool) {
            this.pool.release(obj);
        }
    }

    createAnimation(name: string): THREE.AnimationClip {
        return this.cache.animations.find(a => a.name === name)!;
    }

    getAllAnimations(): THREE.AnimationClip[] {
        return this.cache.animations;
    }
}
