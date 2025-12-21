import * as THREE from 'three';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class BottleFactory implements DecorationFactory {
    private cache: Map<number, THREE.Group> = new Map();
    private animations: THREE.AnimationClip[] = [];

    async load(): Promise<void> {
        // Pre-generate bottles (Green and Blue)
        const greenBottle = this.createBottleMesh(0x88FF88);
        const blueBottle = this.createBottleMesh(0x0088FF);

        GraphicsUtils.tracker.retain(greenBottle);
        GraphicsUtils.tracker.retain(blueBottle);

        this.cache.set(0x88FF88, greenBottle);
        this.cache.set(0x0088FF, blueBottle);

        this.animations.push(this.createFadeAnimation());
        this.animations.push(this.createDropAnimation());
        this.animations.push(this.createArcAnimation(-1));
        this.animations.push(this.createArcAnimation(1));

        // Retain animations too
        this.animations.forEach(a => GraphicsUtils.tracker.retain(a));
    }

    create(color: number): THREE.Group {
        if (!this.cache.has(color)) {
            const mesh = this.createBottleMesh(color);
            GraphicsUtils.tracker.retain(mesh);
            this.cache.set(color, mesh);
        }
        const mesh = this.cache.get(color)!.clone();

        return mesh;
    }

    createAnimation(name: string): THREE.AnimationClip {
        return this.animations.find(a => a.name === name);
    }

    private createBottleMesh(color: number): THREE.Group {
        const mesh = new THREE.Group();

        // Bottle Body
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
        bodyGeo.name = 'Bottle Body';

        const glassMat = new THREE.MeshToonMaterial({
            color: color,
            transparent: true,
            opacity: 0.6
        });
        glassMat.name = 'Bottle Glass';

        const body = new THREE.Mesh(bodyGeo, glassMat);
        body.name = 'body';
        mesh.add(body);

        // Bottle Neck
        const neckGeo = new THREE.CylinderGeometry(0.2, 0.4, 0.6, 8);
        neckGeo.name = 'Bottle Neck';

        const neck = new THREE.Mesh(neckGeo, glassMat);
        neck.position.y = 0.9;
        neck.name = 'neck';
        mesh.add(neck);

        // Cork
        const corkGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.3, 8);
        corkGeo.name = 'Bottle Cork';

        const corkMat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
        corkMat.name = 'Bottle Cork';

        const cork = new THREE.Mesh(corkGeo, corkMat);
        cork.position.y = 1.3;
        cork.name = 'cork';
        mesh.add(cork);

        // Paper Message
        const paperGeo = new THREE.PlaneGeometry(0.3, 0.6);
        paperGeo.name = 'Bottle Paper';

        const paperMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
        paperMat.name = 'Bottle Paper';

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

        return new THREE.AnimationClip('fade', duration, tracks);
    }

    /**
     * Creates a position-independent drop animation from (0, dropHeight, 0) to (0, 0, 0)
     */
    private createDropAnimation(): THREE.AnimationClip {
        const dropHeight = 5.0;
        const duration = 0.25;
        const times = [0, duration];
        const values = [
            0, dropHeight, 0,  // Start
            0, 0, 0            // End (at origin)
        ];
        const positionTrack = new THREE.VectorKeyframeTrack('.position', times, values);
        return new THREE.AnimationClip('drop', duration, [positionTrack]);
    }

    /**
     * Creates a position-independent arc animation
     * @param direction -1 for left, 1 for right
     */
    private createArcAnimation(direction: number): THREE.AnimationClip {
        const duration = 0.8;
        const arcHeight = 8.0;
        const arcDistX = 4.0;

        // All positions are relative to origin (0, 0, 0)
        const startX = 0, startY = 0, startZ = 0;
        const controlX = direction * arcDistX;
        const controlY = arcHeight;
        const controlZ = 0;
        const endX = direction * arcDistX * 2.0;
        const endY = 0;
        const endZ = 0;

        const samples = 10;
        const times: number[] = [];
        const posValues: number[] = [];
        const rotValues: number[] = [];

        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(startX, startY, startZ),
            new THREE.Vector3(controlX, controlY, controlZ),
            new THREE.Vector3(endX, endY, endZ)
        );

        const upAxis = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            times.push(t * duration);

            const point = curve.getPoint(t);
            posValues.push(point.x, point.y, point.z);

            const tangent = curve.getTangent(t).normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(upAxis, tangent);
            rotValues.push(q.x, q.y, q.z, q.w);
        }

        const positionTrack = new THREE.VectorKeyframeTrack('.position', times, posValues);
        const rotationTrack = new THREE.QuaternionKeyframeTrack('.quaternion', times, rotValues);

        const arcClipName = direction < 0 ? 'arc-left' : 'arc-right';
        return new THREE.AnimationClip(arcClipName, duration, [positionTrack, rotationTrack]);
    }
}
