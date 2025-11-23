import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise.js';

export class RiverPath {
    constructor() {
        this.noise = new SimplexNoise();
        this.pathScale = 0.005; 
        this.pathAmplitude = 100.0;
        this.widthScale = 0.01;
        this.baseWidth = 40.0;
        this.widthVar = 15.0;
    }

    getPointAt(z) {
        // x = noise(z)
        const x = this.noise.noise2D(0, z * this.pathScale) * this.pathAmplitude;
        return new THREE.Vector3(x, 0, z);
    }

    getWidthAt(z) {
        // w = noise(z)
        const n = this.noise.noise2D(100, z * this.widthScale);
        return this.baseWidth + n * this.widthVar;
    }

    getTangentAt(z) {
        const delta = 1.0;
        const p1 = this.getPointAt(z + delta);
        const p2 = this.getPointAt(z - delta);
        return new THREE.Vector3().subVectors(p2, p1).normalize();
    }
}
