import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class FlowerFactory implements DecorationFactory {
    private static readonly sharedMaterial = new THREE.MeshToonMaterial({
        color: 0xffffff,
        name: 'Flower - Shared Material'
    });

    private stalkGeometries: { geometry: THREE.BufferGeometry, height: number, topOffset: THREE.Vector3 }[] = [];
    private petalGroupGeometries: THREE.BufferGeometry[] = [];
    private centerGeometry: THREE.BufferGeometry | null = null;

    async load(): Promise<void> {
        GraphicsUtils.registerObject(FlowerFactory.sharedMaterial);

        // 1. Generate Stalk Variations
        const stalkHeights = [0.4, 0.7, 1.0];
        for (const height of stalkHeights) {
            const stalkGeo = new THREE.CylinderGeometry(0.02, 0.04, height, 4, 3);
            this.applyJitter(stalkGeo, 0.05);

            const bendDirection = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            const bendAmount = 0.1 + Math.random() * 0.2;
            this.applyStalkBend(stalkGeo, height, bendDirection, bendAmount);

            stalkGeo.name = `Flower - Stalk Geometry ${height}`;
            stalkGeo.translate(0, height / 2, 0); // Base at 0
            GraphicsUtils.registerObject(stalkGeo);

            const topOffset = bendDirection.clone().multiplyScalar(bendAmount);
            topOffset.y = height;

            this.stalkGeometries.push({ geometry: stalkGeo, height, topOffset });
        }

        // 2. Generate Petal Group Variations
        // ... (rest of load remains same)
        const petalShapes = [
            { geo: new THREE.BoxGeometry(0.1, 0.02, 0.4), name: 'Box' },
            { geo: new THREE.TetrahedronGeometry(0.2), name: 'Tetra' }
        ];

        // Prepare Tetra shape (needs scaling and offset like before)
        petalShapes[1].geo.scale(0.5, 0.1, 1.5);

        // Adjust both shapes to rotate from base
        petalShapes.forEach(s => s.geo.translate(0, 0, 0.2));

        const petalCounts = [5, 6, 8, 10, 12];
        const goldenAngle = 137.5 * (Math.PI / 180);

        for (const shape of petalShapes) {
            for (const count of petalCounts) {
                const tilts = [-0.2, 0.2]; // Upward and downward tilt variations
                for (const tilt of tilts) {
                    const geometriesToMerge: THREE.BufferGeometry[] = [];

                    for (let i = 0; i < count; i++) {
                        const petalGeo = shape.geo.clone();
                        const angle = i * goldenAngle;
                        const dist = 0.05 * Math.sqrt(i);

                        // Position & Rotate
                        // We do this manually to avoid creating dummy Objects
                        const matrix = new THREE.Matrix4();
                        const pos = new THREE.Vector3(
                            Math.cos(angle) * dist,
                            0, // At the top of whatever stalk it will be on
                            Math.sin(angle) * dist
                        );
                        const rot = new THREE.Quaternion().setFromEuler(
                            new THREE.Euler(tilt, -angle, 0)
                        );
                        matrix.compose(pos, rot, new THREE.Vector3(1, 1, 1));
                        petalGeo.applyMatrix4(matrix);

                        geometriesToMerge.push(petalGeo);
                    }

                    const merged = BufferGeometryUtils.mergeGeometries(geometriesToMerge);
                    merged.name = `Flower - ${shape.name} Petal Group ${count} (tilt ${tilt})`;
                    GraphicsUtils.registerObject(merged);
                    this.petalGroupGeometries.push(merged);

                    // Cleanup clones
                    geometriesToMerge.forEach(g => g.dispose());
                }
            }
        }

        // Cleanup base shapes
        petalShapes.forEach(s => s.geo.dispose());

        // 3. Generate Center (Pistil)
        const centerGeo = new THREE.IcosahedronGeometry(0.15, 0);
        centerGeo.name = 'Flower - Center';
        GraphicsUtils.registerObject(centerGeo);
        this.centerGeometry = centerGeo;
    }

    private applyJitter(geo: THREE.BufferGeometry, amount: number) {
        const positions = geo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            // More jitter higher up
            const factor = Math.max(0, y);
            positions.setX(i, positions.getX(i) + (Math.random() - 0.5) * amount * factor);
            positions.setZ(i, positions.getZ(i) + (Math.random() - 0.5) * amount * factor);
        }
        geo.computeVertexNormals();
    }

    private applyStalkBend(geo: THREE.BufferGeometry, height: number, bendDirection: THREE.Vector3, bendAmount: number) {
        const positions = geo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            const t = Math.max(0, y / height);
            // Sine-ish bend
            const shift = Math.sin(t * Math.PI * 0.5) * bendAmount;
            positions.setX(i, positions.getX(i) + bendDirection.x * shift);
            positions.setZ(i, positions.getZ(i) + bendDirection.z * shift);
        }
        geo.computeVertexNormals();
    }

    public createInstance(): DecorationInstance[] {
        const stalkIdx = Math.floor(Math.random() * this.stalkGeometries.length);
        const petalGroupIdx = Math.floor(Math.random() * this.petalGroupGeometries.length);
        const stalk = this.stalkGeometries[stalkIdx];
        const petalGroupGeo = this.petalGroupGeometries[petalGroupIdx];

        const scale = 0.8 + Math.random() * 1.5;
        const stalkRotationY = Math.random() * Math.PI * 2;
        const stalkRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, stalkRotationY, 0));

        // Head orientation relative to stalk (angled more horizontally: 45 to 80 degrees tilt)
        const headTilt = (Math.PI / 4) + Math.random() * (Math.PI / 4);
        const headYaw = Math.random() * Math.PI * 2;
        const headRotationLocal = new THREE.Quaternion().setFromEuler(new THREE.Euler(headTilt, headYaw, 0, 'YXZ'));
        const headRotationWorld = headRotationLocal.clone().premultiply(stalkRotation);

        const stalkColor = new THREE.Color().setHSL(0.3 + Math.random() * 0.1, 0.6, 0.4);
        const centerColor = new THREE.Color().setHSL(0.1 + Math.random() * 0.1, 0.8, 0.5);
        const petalColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);

        const instances: DecorationInstance[] = [];

        // 1. Stalk
        const stalkMatrix = new THREE.Matrix4();
        stalkMatrix.compose(
            new THREE.Vector3(0, 0, 0),
            stalkRotation,
            new THREE.Vector3(scale, scale, scale)
        );
        instances.push({
            geometry: stalk.geometry,
            material: FlowerFactory.sharedMaterial,
            matrix: stalkMatrix,
            color: stalkColor
        });

        // 2. Center
        const headMatrix = new THREE.Matrix4();
        const headPos = stalk.topOffset.clone().multiplyScalar(scale);
        headPos.applyQuaternion(stalkRotation);

        headMatrix.compose(
            headPos,
            headRotationWorld,
            new THREE.Vector3(scale, scale, scale)
        );
        instances.push({
            geometry: this.centerGeometry!,
            material: FlowerFactory.sharedMaterial,
            matrix: headMatrix,
            color: centerColor
        });

        // 3. Petal Group
        const petalMatrix = new THREE.Matrix4();
        petalMatrix.compose(
            headPos,
            headRotationWorld,
            new THREE.Vector3(scale, scale, scale)
        );
        instances.push({
            geometry: petalGroupGeo,
            material: FlowerFactory.sharedMaterial,
            matrix: petalMatrix,
            color: petalColor
        });

        return instances;
    }
}
