import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise.js';

export class RiverPath {
    constructor() {
        this.noise = new SimplexNoise();
        this.humidityNoise = new SimplexNoise();
        this.temperatureNoise = new SimplexNoise();

        this.widthScale = 0.01;
        this.baseWidth = 40.0;
        this.widthVar = 15.0;
        this.biomeScale = 400;
        
        // Path generation state
        this.stepSize = 1.0; // Higher resolution (was 2.0)
        this.maxCurvature = 0.005; // Very gentle curvature limit
        
        this.points = new Map(); // Cache: index -> x
        this.minGenIndex = 0;
        this.maxGenIndex = 0;
        
        // Initial conditions
        this.points.set(0, 0);
        this.points.set(1, 0); // Start straight
        this.points.set(-1, 0); // Backwards compatibility
        this.maxGenIndex = 1;
        this.minGenIndex = -1;
    }

    getHumidityAt(z) {
        const rawHumidity = this.humidityNoise.noise2D(13.37, z / this.biomeScale);
        // Apply a positive bias to make the world slightly wetter, then clamp to the original range.
        const biasedHumidity = rawHumidity + 0.2; // Adjust this value for more/less wetness
        return Math.min(1, Math.max(-1, biasedHumidity));
    }

    getPointAt(z) {
        const index = Math.floor(z / this.stepSize);
        const t = (z % this.stepSize) / this.stepSize;
        
        if (index >= 0) {
            this.ensureGeneratedPositive(index + 1);
        } else {
            this.ensureGeneratedNegative(index);
        }
        
        const x0 = this.points.get(index);
        const x1 = this.points.get(index + 1);
        
        if (x0 === undefined || x1 === undefined) {
            // console.warn("RiverPath: Undefined point at index", index, index+1);
            return new THREE.Vector3(0, 0, z);
        }

        // Linear Interpolation (Robust and smooth enough with stepSize=1.0)
        const x = x0 + (x1 - x0) * t;
        
        return new THREE.Vector3(x, 0, z);
    }
    
    ensureGeneratedPositive(targetIndex) {
        if (targetIndex > this.maxGenIndex) {
            for (let i = this.maxGenIndex + 1; i <= targetIndex; i++) {
                // Verlet: x[i] = 2*x[i-1] - x[i-2] + acc
                const x1 = this.points.get(i - 1);
                const x2 = this.points.get(i - 2);
                
                // Lower frequency noise for lazy river
                const noiseVal = this.noise.noise2D(0, i * 0.005); 
                
                let acc = noiseVal * 0.05; // Reduced amplitude driver
                if (acc > this.maxCurvature) acc = this.maxCurvature;
                if (acc < -this.maxCurvature) acc = -this.maxCurvature;
                
                const x = 2 * x1 - x2 + acc * (this.stepSize * this.stepSize);
                this.points.set(i, x);
            }
            this.maxGenIndex = targetIndex;
        }
    }

    ensureGeneratedNegative(targetIndex) {
        if (targetIndex < this.minGenIndex) {
            for (let i = this.minGenIndex - 1; i >= targetIndex; i--) {
                // Inverse Verlet: x[i-2] = 2*x[i-1] - x[i] + acc
                // So x[i] = 2*x[i+1] - x[i+2] + acc
                const x1 = this.points.get(i + 1);
                const x2 = this.points.get(i + 2);
                
                const noiseVal = this.noise.noise2D(0, i * 0.005);
                let acc = noiseVal * 0.05;
                if (acc > this.maxCurvature) acc = this.maxCurvature;
                if (acc < -this.maxCurvature) acc = -this.maxCurvature;
                
                const x = 2 * x1 - x2 + acc * (this.stepSize * this.stepSize);
                this.points.set(i, x);
            }
            this.minGenIndex = targetIndex;
        }
    }

    getWidthAt(z) {
        // w = noise(z)
        const n = this.noise.noise2D(100, z * this.widthScale);
        return this.baseWidth + n * this.widthVar;
    }

    getTangentAt(z) {
        const delta = 0.5;
        const p1 = this.getPointAt(z + delta);
        const p2 = this.getPointAt(z - delta);
        return new THREE.Vector3().subVectors(p2, p1).normalize();
    }

    getRiverBoundarySegments(zCenter, range) {
        const segments = [];
        const step = 5.0; // Segment length
        const zStart = zCenter + range;
        const zEnd = zCenter - range;
        
        // We iterate from positive Z to negative Z (downstream usually)
        for (let z = zStart; z > zEnd; z -= step) {
            const currZ = z;
            const nextZ = z - step;
            
            // Current slice
            const p1 = this.getPointAt(currZ);
            const t1 = this.getTangentAt(currZ);
            const w1 = this.getWidthAt(currZ);
            const n1 = new THREE.Vector3().crossVectors(t1, new THREE.Vector3(0, 1, 0)).normalize();
            
            // Next slice
            const p2 = this.getPointAt(nextZ);
            const t2 = this.getTangentAt(nextZ);
            const w2 = this.getWidthAt(nextZ);
            const n2 = new THREE.Vector3().crossVectors(t2, new THREE.Vector3(0, 1, 0)).normalize();
            
            // Left Bank Segment
            const l1 = p1.clone().add(n1.clone().multiplyScalar(-w1/2));
            const l2 = p2.clone().add(n2.clone().multiplyScalar(-w2/2));
            
            // Right Bank Segment
            const r1 = p1.clone().add(n1.clone().multiplyScalar(w1/2));
            const r2 = p2.clone().add(n2.clone().multiplyScalar(w2/2));
            
            // Push segments. Normal points INWARDS to the river for collision logic?
            // Actually, for "wall" logic, normal usually points OUT of the wall (towards the river).
            // Left bank normal should point roughly +X (if river is -Z).
            // Right bank normal should point roughly -X.
            
            // Left bank normal: (l2 - l1) cross UP
            const leftDir = new THREE.Vector3().subVectors(l2, l1).normalize();
            const leftNormal = new THREE.Vector3().crossVectors(leftDir, new THREE.Vector3(0, 1, 0)).normalize();
            
            // Right bank normal: (r2 - r1) cross DOWN (or UP and negate?)
            // Let's stick to: Wall normal points towards the playable area (river center).
            const rightDir = new THREE.Vector3().subVectors(r2, r1).normalize();
            const rightNormal = new THREE.Vector3().crossVectors(rightDir, new THREE.Vector3(0, -1, 0)).normalize();

            segments.push({
                start: l1,
                end: l2,
                normal: leftNormal,
                type: 'left'
            });
            
            segments.push({
                start: r1,
                end: r2,
                normal: rightNormal,
                type: 'right'
            });
        }
        return segments;
    }
}
