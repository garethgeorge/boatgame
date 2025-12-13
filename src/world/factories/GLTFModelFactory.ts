import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DecorationFactory, DecorationResult } from './DecorationFactory';

interface GLTFModelData {
    model: THREE.Group | null;
    animations: THREE.AnimationClip[];
}

export class GLTFModelFactory implements DecorationFactory {
    private cache: GLTFModelData = { model: null, animations: [] };
    private path: string;

    constructor(path: string) {
        this.path = path;
    }

    async load(): Promise<void> {
        if (this.cache.model) return;

        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(this.path, (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.cache.model = model;
                this.cache.animations = gltf.animations || [];
                resolve();
            }, undefined, (error) => {
                console.error(`An error occurred loading model ${this.path}:`, error);
                resolve(); // Resolve anyway to avoid blocking everything
            });
        });
    }

    create(): DecorationResult {
        if (!this.cache.model) {
            console.warn(`Model ${this.path} not loaded yet`);
            throw new Error(`Model ${this.path} not loaded yet`);
        }

        const clonedModel = SkeletonUtils.clone(this.cache.model) as THREE.Group;
        return {
            model: clonedModel,
            animations: this.cache.animations
        };
    }
}
