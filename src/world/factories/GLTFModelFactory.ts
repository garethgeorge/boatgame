import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

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
                GraphicsUtils.registerObject(model);
                GraphicsUtils.toonify(model);
                GraphicsUtils.markAsCache(model);
                this.cache.model = model;
                this.cache.animations = gltf.animations || [];
                resolve();
            }, undefined, (error) => {
                console.error(`An error occurred loading model ${this.path}:`, error);
                resolve(); // Resolve anyway to avoid blocking everything
            });
        });
    }

    create(): THREE.Group {
        if (!this.cache.model) {
            console.warn(`Model ${this.path} not loaded yet`);
            throw new Error(`Model ${this.path} not loaded yet`);
        }

        const clonedModel = SkeletonUtils.clone(this.cache.model) as THREE.Group;
        GraphicsUtils.registerObject(clonedModel);
        return clonedModel;
    }

    createAnimation(name: string): THREE.AnimationClip {
        return this.cache.animations.find(a => a.name === name);
    }

    getAllAnimations(): THREE.AnimationClip[] {
        return this.cache.animations;
    }
}
