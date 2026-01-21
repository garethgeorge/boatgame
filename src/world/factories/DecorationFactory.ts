import * as THREE from 'three';

/**
 * Note that the geometry and material here must not be a clone, It
 * must be an archetype that is already owned by something so that
 * it is ok to choose not to use the DecorationInstance.
 */
export interface DecorationInstance {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    matrix: THREE.Matrix4;
    color?: THREE.Color;
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
