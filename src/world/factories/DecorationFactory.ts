import * as THREE from 'three';

export interface DecorationInstance {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    matrix: THREE.Matrix4;
}

export interface DecorationFactory {
    // pre-load
    load(): Promise<void>;

    // create mesh (optional fallback)
    create?(options?: any): THREE.Group;

    // create individual instances for instanced rendering
    createInstance?(options?: any): DecorationInstance[];

    // create animation
    createAnimation?(name: string, options?: any): THREE.AnimationClip;

    // get all animations
    getAllAnimations?(): THREE.AnimationClip[];
}
