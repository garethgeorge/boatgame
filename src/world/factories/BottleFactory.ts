import * as THREE from 'three';
import { DecorationFactory, DecorationResult } from './DecorationFactory';

export class BottleFactory implements DecorationFactory {
    private cache: Map<number, THREE.Group> = new Map();
    private fadeAnimation: THREE.AnimationClip | null = null;

    async load(): Promise<void> {
        // Pre-generate bottles (Green and Blue)
        this.cache.set(0x88FF88, this.createBottleMesh(0x88FF88));
        this.cache.set(0x0088FF, this.createBottleMesh(0x0088FF));
        this.fadeAnimation = this.createFadeAnimation();
    }

    create(color: number): DecorationResult {
        if (!this.cache.has(color)) {
            this.cache.set(color, this.createBottleMesh(color));
        }
        const mesh = this.cache.get(color)!.clone();

        // Ensure animation is created if load() wasn't called (generic fallback)
        if (!this.fadeAnimation) {
            this.fadeAnimation = this.createFadeAnimation();
        }

        return { model: mesh, animations: [this.fadeAnimation] };
    }

    private createBottleMesh(color: number): THREE.Group {
        const mesh = new THREE.Group();

        // Bottle Body
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
        const glassMat = new THREE.MeshToonMaterial({
            color: color,
            transparent: true,
            opacity: 0.6
        });
        const body = new THREE.Mesh(bodyGeo, glassMat);
        body.name = 'body';
        mesh.add(body);

        // Bottle Neck
        const neckGeo = new THREE.CylinderGeometry(0.2, 0.4, 0.6, 8);
        const neck = new THREE.Mesh(neckGeo, glassMat);
        neck.position.y = 0.9;
        neck.name = 'neck';
        mesh.add(neck);

        // Cork
        const corkGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.3, 8);
        const corkMat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
        const cork = new THREE.Mesh(corkGeo, corkMat);
        cork.position.y = 1.3;
        cork.name = 'cork';
        mesh.add(cork);

        // Paper Message
        const paperGeo = new THREE.PlaneGeometry(0.3, 0.6);
        const paperMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
        const paper = new THREE.Mesh(paperGeo, paperMat);
        paper.rotation.y = Math.PI / 4;
        paper.rotation.z = Math.PI / 8;
        paper.name = 'paper';
        mesh.add(paper);

        return mesh;
    }

    private createFadeAnimation(): THREE.AnimationClip {
        const duration = 1.0;
        const times = [0, duration];
        const tracks: THREE.KeyframeTrack[] = [];

        tracks.push(new THREE.NumberKeyframeTrack('body.material.opacity', times, [0.6, 0]));
        tracks.push(new THREE.NumberKeyframeTrack('neck.material.opacity', times, [0.6, 0]));
        tracks.push(new THREE.NumberKeyframeTrack('cork.material.opacity', times, [1.0, 0]));
        tracks.push(new THREE.NumberKeyframeTrack('paper.material.opacity', times, [1.0, 0]));

        return new THREE.AnimationClip('BottleHit', duration, tracks);
    }
}
