import * as THREE from 'three';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class BushFactory implements DecorationFactory {
    private static readonly dryBushMaterial = new THREE.MeshToonMaterial({ color: 0x8B5A2B, name: 'Bush - Dry Material' }); // Brownish
    private static readonly greenBushMaterial = new THREE.MeshToonMaterial({ color: 0x32CD32, name: 'Bush - Green Material' }); // Lime Green

    private cache: { mesh: THREE.Group, wetness: number }[] = [];

    async load(): Promise<void> {
        // Retain static materials
        GraphicsUtils.registerObject(BushFactory.dryBushMaterial);
        GraphicsUtils.registerObject(BushFactory.greenBushMaterial);

        // Clear existing cache and release old meshes
        this.cache.forEach(b => GraphicsUtils.disposeObject(b.mesh));
        this.cache = [];

        console.log("Generating Bush Cache...");
        for (let i = 0; i < 50; i++) {
            const wetness = Math.random();
            const mesh = this.createBush(wetness);
            GraphicsUtils.markAsCache(mesh);
            this.cache.push({ mesh, wetness });
        }
    }

    create(wetness: number): THREE.Group {
        let mesh: THREE.Group;
        if (this.cache.length === 0) {
            mesh = this.createBush(wetness);
        } else {
            const candidates = this.cache.filter(b => Math.abs(b.wetness - wetness) < 0.3);
            const source = candidates.length > 0
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : this.cache[Math.floor(Math.random() * this.cache.length)];

            mesh = source ? GraphicsUtils.cloneObject(source.mesh) : this.createBush(wetness);
        }
        return mesh;
    }

    private createBush(wetness: number): THREE.Group {
        const group = new THREE.Group();

        if (wetness > 0.5) {
            // FERN (Wet) - Larger
            const frondCount = 6 + Math.floor(Math.random() * 5);
            for (let i = 0; i < frondCount; i++) {
                const length = (1.5 + Math.random() * 1.5) * 3.0; // 3x larger
                const width = (0.5 + Math.random() * 0.3) * 3.0; // 3x larger

                const segments = 5;
                const segmentLen = length / segments;

                const curveGroup = new THREE.Group();
                const angleY = (i / frondCount) * Math.PI * 2 + (Math.random() * 0.5);
                const angleX = Math.PI / 4 + Math.random() * 0.3;

                curveGroup.rotation.y = angleY;

                let currentPos = new THREE.Vector3(0, 0, 0);
                let currentAngle = angleX;

                for (let k = 0; k < segments; k++) {
                    const segWidth = width * (1 - k / segments);
                    const segGeo = new THREE.PlaneGeometry(segWidth, segmentLen);
                    segGeo.name = 'Bush - Fern Frond Segment Geometry';
                    segGeo.translate(0, segmentLen / 2, 0);

                    const seg = GraphicsUtils.createMesh(segGeo, BushFactory.greenBushMaterial, 'BushSegment');
                    seg.position.copy(currentPos);
                    seg.rotation.x = currentAngle;
                    (seg.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;

                    curveGroup.add(seg);

                    currentPos.add(new THREE.Vector3(0, segmentLen, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), currentAngle));
                    currentAngle += 0.25; // Less curve for longer fronds
                }
                group.add(curveGroup);
            }

        } else {
            // DEAD BUSH (Dry)
            const material = BushFactory.dryBushMaterial;

            const generateJaggedBranch = (start: THREE.Vector3, len: number, thick: number, depth: number, ang: THREE.Euler) => {
                if (depth === 0) return;

                const end = start.clone().add(new THREE.Vector3(0, len, 0).applyEuler(ang));
                const mid = start.clone().add(end).multiplyScalar(0.5);

                const geo = new THREE.CylinderGeometry(thick * 0.7, thick, len, 4);
                geo.name = 'Bush - Dead Branch Geometry';
                const mesh = GraphicsUtils.createMesh(geo, material, 'BushSingle');
                mesh.position.copy(mid);
                mesh.lookAt(end);
                mesh.rotateX(Math.PI / 2);
                group.add(mesh);

                // 1 or 2 sub-branches, jagged angles
                const count = 1 + Math.floor(Math.random() * 2);
                for (let i = 0; i < count; i++) {
                    const newLen = len * 0.6;
                    const newThick = thick * 0.7;

                    // Jagged angle: abrupt change
                    const newAng = new THREE.Euler(
                        ang.x + (Math.random() - 0.5) * 2.0,
                        ang.y + (Math.random() - 0.5) * 2.0,
                        ang.z + (Math.random() - 0.5) * 2.0
                    );
                    generateJaggedBranch(end, newLen, newThick, depth - 1, newAng);
                }
            };

            // 2-3 Stems from ground
            const stemCount = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < stemCount; i++) {
                // Random angle out from center
                const angleY = Math.random() * Math.PI * 2;
                const angleX = 0.3 + Math.random() * 0.5; // Angle up from ground

                const startAngle = new THREE.Euler(
                    (Math.random() - 0.5) * 1.5, // Widen spread
                    angleY,
                    (Math.random() - 0.5) * 1.5 // Widen spread
                );

                // Increase base size by 3x
                generateJaggedBranch(new THREE.Vector3(0, 0, 0), 0.5 * 3.0, 0.1 * 3.0, 3, startAngle);
            }
        }

        return group;
    }
}
