import { SceneLoader, AssetContainer, TransformNode, AnimationGroup, Engine } from '@babylonjs/core';
import '@babylonjs/loaders'; // Import loaders side-effects
import { DecorationFactory } from './DecorationFactory';

interface GLTFModelData {
    container: AssetContainer | null;
}

export class GLTFModelFactory implements DecorationFactory {
    private cache: GLTFModelData = { container: null };
    private path: string;

    constructor(path: string) {
        this.path = path;
    }

    private lastInstantiatedAnimations: AnimationGroup[] = [];

    async load(): Promise<void> {
        if (this.cache.container) return;

        const scene = Engine.LastCreatedScene;
        if (!scene) {
            console.error("No scene found for loading assets");
            return;
        }

        this.cache.container = await SceneLoader.LoadAssetContainerAsync("", this.path, scene);

        // Optional: Toonify materials in the container before instantiation?
        // this.cache.container.materials.forEach(mat => { ... });
    }

    create(): TransformNode {
        if (!this.cache.container) {
            throw new Error(`Model ${this.path} not loaded yet`);
        }

        const entries = this.cache.container.instantiateModelsToScene(undefined, true);
        const root = entries.rootNodes[0] as TransformNode;
        this.lastInstantiatedAnimations = entries.animationGroups;

        return root;
    }

    createAnimation(name: string): AnimationGroup {
        const anim = this.lastInstantiatedAnimations.find(a => a.name.includes(name));
        if (!anim) throw new Error(`Animation ${name} not found in ${this.path}`);
        return anim;
    }

    getAllAnimations(): AnimationGroup[] {
        return this.lastInstantiatedAnimations;
    }
}
