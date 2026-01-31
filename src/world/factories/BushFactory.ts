import * as THREE from 'three';
import { DecorationFactory, DecorationInstance, NUM_DECORATION_ARCHETYPES } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface BushArchetype {
    geometry: THREE.BufferGeometry;
    isWet: boolean;
}

export class BushFactory implements DecorationFactory {
    private static readonly dryBushMaterial = new THREE.MeshToonMaterial({ color: 0x8B5A2B, name: 'Bush - Dry Material' }); // Brownish
    private static readonly greenBushMaterial = new THREE.MeshToonMaterial({ color: 0x32CD32, name: 'Bush - Green Material', side: THREE.DoubleSide }); // Lime Green

    private archetypes: BushArchetype[] = [];

    async load(): Promise<void> {
        // Retain static materials
        GraphicsUtils.registerObject(BushFactory.dryBushMaterial);
        GraphicsUtils.registerObject(BushFactory.greenBushMaterial);

        // Clear existing archetypes
        this.archetypes.forEach(a => GraphicsUtils.disposeObject(a.geometry));
        this.archetypes = [];

        console.log("Generating Bush Archetypes...");
        // Generate Wet Bushes (Ferns)
        for (let i = 0; i < NUM_DECORATION_ARCHETYPES; i++) {
            this.archetypes.push(this.generateArchetype(true));
        }
        // Generate Dry Bushes (Dead)
        for (let i = 0; i < NUM_DECORATION_ARCHETYPES; i++) {
            this.archetypes.push(this.generateArchetype(false));
        }
    }

    createInstance(wetness: number = 0.5): DecorationInstance[] {
        const isWet = wetness > 0.5;
        const candidates = this.archetypes.filter(a => a.isWet === isWet);
        if (candidates.length === 0) return [];

        const archetype = candidates[Math.floor(Math.random() * candidates.length)];

        // Random scale jitter
        const scale = 0.9 + Math.random() * 0.2;
        const matrix = new THREE.Matrix4().makeScale(scale, scale, scale);

        return [{
            geometry: archetype.geometry,
            material: isWet ? BushFactory.greenBushMaterial : BushFactory.dryBushMaterial,
            matrix: matrix,
            color: new THREE.Color(1, 1, 1)
        }];
    }

    create(wetness: number = 0.5): THREE.Group {
        const instances = this.createInstance(wetness);
        const group = new THREE.Group();
        for (const inst of instances) {
            const mesh = GraphicsUtils.createMesh(inst.geometry, inst.material);
            mesh.applyMatrix4(inst.matrix);
            group.add(mesh);
        }
        return group;
    }

    private generateArchetype(isWet: boolean): BushArchetype {
        const geometries: THREE.BufferGeometry[] = [];

        if (isWet) {
            // FERN (Wet)
            const frondCount = 6 + Math.floor(Math.random() * 5);
            for (let i = 0; i < frondCount; i++) {
                const length = (1.5 + Math.random() * 1.5) * 3.0;
                const width = (0.5 + Math.random() * 0.3) * 3.0;

                const segments = 5;
                const segmentLen = length / segments;

                const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.5);
                const angleX = Math.PI / 4 + Math.random() * 0.3;

                let currentPos = new THREE.Vector3(0, 0, 0);
                let currentAngle = angleX;

                for (let k = 0; k < segments; k++) {
                    const segWidth = width * (1 - k / segments);
                    const segGeo = new THREE.PlaneGeometry(segWidth, segmentLen);
                    segGeo.translate(0, segmentLen / 2, 0);

                    const matrix = new THREE.Matrix4()
                        .makeRotationFromEuler(new THREE.Euler(currentAngle, angleY, 0, 'YXZ'))
                        .setPosition(currentPos);

                    segGeo.applyMatrix4(matrix);
                    geometries.push(segGeo);

                    const forward = new THREE.Vector3(0, segmentLen, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), currentAngle).applyAxisAngle(new THREE.Vector3(0, 1, 0), angleY);
                    currentPos.add(forward);
                    currentAngle += 0.25;
                }
            }
        } else {
            // DEAD BUSH (Dry)
            const generateJaggedBranch = (start: THREE.Vector3, len: number, thick: number, depth: number, ang: THREE.Euler) => {
                if (depth === 0) return;

                const end = start.clone().add(new THREE.Vector3(0, len, 0).applyEuler(ang));
                const mid = start.clone().add(end).multiplyScalar(0.5);

                const geo = new THREE.CylinderGeometry(thick * 0.7, thick, len, 4);

                // Align cylinder to branch direction
                const direction = end.clone().sub(start).normalize();
                const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
                const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion).setPosition(mid);

                geo.applyMatrix4(matrix);
                geometries.push(geo);

                const count = 1 + Math.floor(Math.random() * 2);
                for (let i = 0; i < count; i++) {
                    const newLen = len * 0.6;
                    const newThick = thick * 0.7;
                    const newAng = new THREE.Euler(
                        ang.x + (Math.random() - 0.5) * 2.0,
                        ang.y + (Math.random() - 0.5) * 2.0,
                        ang.z + (Math.random() - 0.5) * 2.0
                    );
                    generateJaggedBranch(end, newLen, newThick, depth - 1, newAng);
                }
            };

            const stemCount = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < stemCount; i++) {
                const angleY = Math.random() * Math.PI * 2;
                const startAngle = new THREE.Euler(
                    (Math.random() - 0.5) * 1.5,
                    angleY,
                    (Math.random() - 0.5) * 1.5
                );
                generateJaggedBranch(new THREE.Vector3(0, 0, 0), 0.5 * 3.0, 0.1 * 3.0, 3, startAngle);
            }
        }

        const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries);
        mergedGeo.name = isWet ? 'Bush - Fern Merged Geometry' : 'Bush - Dead Merged Geometry';
        GraphicsUtils.registerObject(mergedGeo);

        // Dispose intermediate geometries
        geometries.forEach(g => GraphicsUtils.disposeObject(g));

        return { geometry: mergedGeo, isWet };
    }
}
