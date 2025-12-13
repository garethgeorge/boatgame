import * as THREE from 'three';

export interface DecorationResult {
    model: THREE.Group;
    animations: THREE.AnimationClip[];
}

export interface DecorationFactory {
    load(): Promise<void>;
    create(options?: any): DecorationResult;
}
