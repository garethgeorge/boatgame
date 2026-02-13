import * as THREE from 'three';
import * as planck from 'planck';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { ConvexHull } from '../../core/ConvexHull';

export class MangroveFactory implements DecorationFactory {
    private cache: THREE.Group[] = [];
    private readonly CACHE_SIZE = 20;
    private loadingPromise: Promise<void> | null = null;

    // Materials
    private trunkMaterial = new THREE.MeshToonMaterial({ color: 0x5D5346, name: 'Mangrove - Trunk Material' }); // Darker swamp wood

    // Leaf material - Solid colors
    private leafMaterial = new THREE.MeshToonMaterial({
        name: 'Mangrove - Leaf Material',
        color: 0xffffff, // White base for vertex colors
        vertexColors: true,
        side: THREE.DoubleSide,
    });

    async load(): Promise<void> {
        if (this.cache.length > 0) return Promise.resolve();
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            GraphicsUtils.registerObject(this.trunkMaterial);
            GraphicsUtils.registerObject(this.leafMaterial);

            this.generateCache();
            this.loadingPromise = null;
        })();

        return this.loadingPromise;
    }

    create(options: { scale?: number } = {}): THREE.Group {
        if (this.cache.length === 0) {
            this.generateCache();
        }
        const template = this.cache[Math.floor(Math.random() * this.cache.length)];
        const mesh = GraphicsUtils.cloneObject(template);

        if (options && options.scale) {
            mesh.scale.setScalar(options.scale);
        }
        return mesh;
    }

    private generateCache() {
        console.log("Generating Mangrove Cache...");
        for (let i = 0; i < this.CACHE_SIZE; i++) {
            const mangrove = this.createMangrove();
            GraphicsUtils.markAsCache(mangrove);
            this.cache.push(mangrove);
        }
    }

    private createMangrove(): THREE.Group {
        const group = new THREE.Group();
        const rootOffsets: { x: number, z: number, r: number }[] = [];

        // Parameters (Scaled 3x)
        const height = (4.0 + Math.random() * 2.0) * 3.0;
        const rootHeight = (1.5 + Math.random() * 0.5) * 3.0; // Height where roots merge
        const spread = (2.0 + Math.random() * 1.0) * 3.0; // Width of root base

        // 1. Roots
        // Use CatmullRomCurve3 for organic, gnarled roots
        const rootCount = 5 + Math.floor(Math.random() * 8); // 5 to 12 roots

        for (let i = 0; i < rootCount; i++) {
            const angle = (i / rootCount) * Math.PI * 2 + (Math.random() * 0.5);
            const dist = spread * (0.6 + Math.random() * 0.8); // Varied distance

            // Points for the root curve
            // Start at bottom (underwater/ground)
            const p0 = new THREE.Vector3(Math.cos(angle) * dist, -2.0, Math.sin(angle) * dist);

            // Attachment point at the trunk base
            const attachAngle = angle + (Math.random() - 0.5) * 0.5; // Slight twist

            const p3 = new THREE.Vector3(
                Math.cos(attachAngle) * 0.2, // Close to center
                rootHeight + 1.0, // Higher up inside trunk
                Math.sin(attachAngle) * 0.2
            );

            const entryRadius = 1.0 + Math.random() * 0.3;
            const p2 = new THREE.Vector3(
                Math.cos(attachAngle) * entryRadius,
                rootHeight - 0.2, // Just below the "merge" height
                Math.sin(attachAngle) * entryRadius
            );

            p2.y += (Math.random() - 0.5) * 0.3;

            const p1 = p0.clone().lerp(p2, 0.5);
            p1.y += 1.0; // Arch up
            p1.x *= 1.2; // Bulge out
            p1.z *= 1.2;

            p1.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(0.5));

            const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);

            // Calculate intersection with Water (y=0) for physics
            const divisions = 20;
            for (let j = 0; j <= divisions; j++) {
                const t = j / divisions;
                const pt = curve.getPoint(t);
                if (pt.y >= 0) {
                    const rootRadius = 0.3 + Math.random() * 0.2;
                    rootOffsets.push({ x: pt.x, z: pt.z, r: rootRadius });
                    break;
                }
            }

            const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.3 + Math.random() * 0.2, 5, false);
            tubeGeo.name = 'Mangrove - Root Geometry';
            const root = GraphicsUtils.createMesh(tubeGeo, this.trunkMaterial, 'MangroveRoot');
            root.castShadow = true;
            root.receiveShadow = true;
            group.add(root);
        }

        // 2. Trunk (Gnarly)
        const trunkHeight = height - rootHeight;

        const trunkPoints = [];
        const trunkSegments = 5;
        for (let i = 0; i <= trunkSegments; i++) {
            const t = i / trunkSegments;
            const y = rootHeight + t * trunkHeight;

            const jitter = (t > 0 && t < 1) ? 0.4 : 0.0;
            const x = (Math.random() - 0.5) * jitter;
            const z = (Math.random() - 0.5) * jitter;

            trunkPoints.push(new THREE.Vector3(x, y, z));
        }

        const trunkCurve = new THREE.CatmullRomCurve3(trunkPoints);
        const trunkGeo = new THREE.TubeGeometry(trunkCurve, 8, 1.2, 7, false);
        trunkGeo.name = 'Mangrove - Trunk Geometry';
        const trunk = GraphicsUtils.createMesh(trunkGeo, this.trunkMaterial, 'MangroveTrunk');
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        // 3. Canopy
        const branchCount = 6 + Math.floor(Math.random() * 4);
        const branchStartY = rootHeight + trunkHeight * 0.5;

        for (let i = 0; i < branchCount; i++) {
            const angle = (i / branchCount) * Math.PI * 2 + Math.random();
            const len = (2.0 + Math.random() * 1.5) * 4.5;

            const branchGeo = new THREE.CylinderGeometry(0.3, 0.6, len, 5);
            branchGeo.name = 'Mangrove - Branch Geometry';
            const branch = GraphicsUtils.createMesh(branchGeo, this.trunkMaterial, 'MangroveBranch');

            const bY = branchStartY + (Math.random() * trunkHeight * 0.4);
            branch.position.set(0, bY, 0);
            branch.rotation.y = angle;
            const zRot = Math.PI / 2 - 0.2 - Math.random() * 0.4;
            branch.rotation.z = zRot;
            branch.translateY(len / 2);

            trunk.add(branch);

            const dir = new THREE.Vector3(0, 1, 0);
            dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), zRot);
            dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            dir.normalize();

            const startPos = new THREE.Vector3(0, bY, 0);

            const leafGroupCount = 5 + Math.floor(Math.random() * 3);
            for (let j = 0; j < leafGroupCount; j++) {
                const t = 0.3 + Math.random() * 0.7;
                const pos = startPos.clone().add(dir.clone().multiplyScalar(len * t));

                pos.x += (Math.random() - 0.5) * 3.0;
                pos.z += (Math.random() - 0.5) * 3.0;
                pos.y += (Math.random() - 0.5) * 0.5;

                const leaf = this.createLeafCluster();
                leaf.position.copy(pos);
                leaf.rotation.y = Math.random() * Math.PI * 2;
                group.add(leaf);
            }
        }

        const topLeafCount = 15;
        for (let i = 0; i < topLeafCount; i++) {
            const leaf = this.createLeafCluster();
            leaf.position.y = height + (Math.random() - 0.5) * 1.5;
            leaf.position.x = (Math.random() - 0.5) * 9.0;
            leaf.position.z = (Math.random() - 0.5) * 9.0;
            leaf.rotation.y = Math.random() * Math.PI * 2;
            group.add(leaf);
        }

        const woodGeometries: THREE.BufferGeometry[] = [];
        group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material === this.trunkMaterial) {
                child.updateMatrixWorld();
                const geo = child.geometry.clone();
                GraphicsUtils.registerObject(geo);
                geo.applyMatrix4(child.matrixWorld);
                woodGeometries.push(geo);
            }
        });

        const leafGeometries: THREE.BufferGeometry[] = [];
        group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material === this.leafMaterial) {
                child.updateMatrixWorld();
                const geo = child.geometry.clone();
                GraphicsUtils.registerObject(geo);
                geo.applyMatrix4(child.matrixWorld);
                leafGeometries.push(geo);
            }
        });

        const finalGroup = new THREE.Group();

        if (woodGeometries.length > 0) {
            const mergedWood = BufferGeometryUtils.mergeGeometries(woodGeometries);
            const woodMesh = GraphicsUtils.createMesh(mergedWood, this.trunkMaterial, 'MangroveWood');
            woodMesh.castShadow = true;
            woodMesh.receiveShadow = true;
            finalGroup.add(woodMesh);
            woodGeometries.forEach(g => GraphicsUtils.disposeObject(g));
        }

        if (leafGeometries.length > 0) {
            const mergedLeaves = BufferGeometryUtils.mergeGeometries(leafGeometries);
            const leafMesh = GraphicsUtils.createMesh(mergedLeaves, this.leafMaterial, 'MangroveLeaves');
            leafMesh.castShadow = false;
            leafMesh.receiveShadow = false;
            finalGroup.add(leafMesh);
            leafGeometries.forEach(g => GraphicsUtils.disposeObject(g));
        }

        GraphicsUtils.disposeObject(group);
        finalGroup.userData.rootOffsets = rootOffsets;

        return finalGroup;
    }

    private createLeafCluster(): THREE.Mesh {
        const triCount = 12 + Math.floor(Math.random() * 6);
        const geom = new THREE.BufferGeometry();
        const positions: number[] = [];
        const colors: number[] = [];
        const normals: number[] = [];

        const baseColor = new THREE.Color(0x7FB048);

        for (let i = 0; i < triCount; i++) {
            const cx = (Math.random() - 0.5) * 4.0;
            const cy = (Math.random() - 0.5) * 3.0;
            const cz = (Math.random() - 0.5) * 4.0;

            const leafColor = baseColor.clone().offsetHSL(
                (Math.random() - 0.5) * 0.08,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.15
            );

            const size = 1.0 + Math.random() * 0.8;

            const p1 = new THREE.Vector3(Math.cos(0) * size, 0, Math.sin(0) * size);
            const p2 = new THREE.Vector3(Math.cos(2 * Math.PI / 3) * size, 0, Math.sin(2 * Math.PI / 3) * size);
            const p3 = new THREE.Vector3(Math.cos(4 * Math.PI / 3) * size, 0, Math.sin(4 * Math.PI / 3) * size);

            const rotY = Math.random() * Math.PI * 2;
            const tiltX = (Math.random() - 0.5) * 0.6;
            const tiltZ = (Math.random() - 0.5) * 0.6;

            const euler = new THREE.Euler(tiltX, rotY, tiltZ);
            p1.applyEuler(euler);
            p2.applyEuler(euler);
            p3.applyEuler(euler);

            p1.add(new THREE.Vector3(cx, cy, cz));
            p2.add(new THREE.Vector3(cx, cy, cz));
            p3.add(new THREE.Vector3(cx, cy, cz));

            positions.push(p1.x, p1.y, p1.z);
            positions.push(p2.x, p2.y, p2.z);
            positions.push(p3.x, p3.y, p3.z);

            colors.push(leafColor.r, leafColor.g, leafColor.b);
            colors.push(leafColor.r, leafColor.g, leafColor.b);
            colors.push(leafColor.r, leafColor.g, leafColor.b);

            const ab = new THREE.Vector3().subVectors(p2, p1);
            const ac = new THREE.Vector3().subVectors(p3, p1);
            const n = new THREE.Vector3().crossVectors(ab, ac).normalize();

            normals.push(n.x, n.y, n.z);
            normals.push(n.x, n.y, n.z);
            normals.push(n.x, n.y, n.z);
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

        return GraphicsUtils.createMesh(geom, this.leafMaterial, 'MangroveLeafCluster');
    }
}
