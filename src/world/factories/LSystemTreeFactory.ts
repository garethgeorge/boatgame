import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import {
    LSystemTreeKind,
    TreeConfig,
    ARCHETYPES,
    BlobLeafKindParams,
    WillowLeafKindParams,
    IrregularLeafKindParams,
    ClusterLeafKindParams,
    UmbrellaLeafKindParams,
} from './LSystemTreeArchetypes';

import {
    ProceduralTree,
    BranchData,
    LeafData,
} from './LSystemTreeGenerator';

export interface LeafGenerator {
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void;
}

export const getOffsetSpherePoint = (center: THREE.Vector3, baseRadius: number, jitter: number): THREE.Vector3 => {
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.acos(2 * Math.random() - 1);

    const dir = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
    );

    const offset = (Math.random() - 0.5) * 2 * jitter;
    const finalRadius = baseRadius + offset;

    return dir.multiplyScalar(finalRadius).add(center);
}

export class BlobLeafGenerator implements LeafGenerator {
    constructor(readonly params: BlobLeafKindParams) { }
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseSize = (1.0 + Math.random() * 0.5) * this.params.size;
        let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(baseSize, 0);

        if (geo.index) {
            geo = geo.toNonIndexed();
        }
        geo.computeVertexNormals();

        geo.scale(1, this.params.thickness, 1);

        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);

        const matrix = new THREE.Matrix4().compose(leafData.pos, quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const color = new THREE.Color(this.params.color);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        GraphicsUtils.addVertexColors(geo, color);

        leafGeos.push(geo);
    }
}

export class WillowLeafGenerator implements LeafGenerator {
    constructor(readonly params: WillowLeafKindParams) { }
    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const strandCount = this.params.strands;
        const targetGroundClearance = 2.0;

        for (let i = 0; i < strandCount; i++) {
            const isTerminal = i === strandCount - 1;
            const sLen = Math.max(1.0, leafData.pos.y - targetGroundClearance) * (0.8 + Math.random() * 0.4);
            const sWidth = 0.15 + Math.random() * 0.1;

            const strandGeo = new THREE.BoxGeometry(sWidth, sLen, sWidth / 2, 1, 8, 1);
            strandGeo.translate(0, sLen / 2, 0);

            this.applyDroop(strandGeo, sLen);

            const radialAngle = Math.random() * Math.PI * 2;
            const jitter = (Math.random() - 0.5) * 0.2;

            const matrix = new THREE.Matrix4().compose(
                leafData.pos,
                new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + jitter, radialAngle, 0, 'YXZ')),
                new THREE.Vector3(1, 1, 1)
            );

            strandGeo.applyMatrix4(matrix);

            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
            GraphicsUtils.addVertexColors(strandGeo, color);

            leafGeos.push(strandGeo);
        }
    }

    private applyDroop(geo: THREE.BufferGeometry, length: number) {
        const positions = geo.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            v.fromBufferAttribute(positions, i);
            const ratio = v.y / length;
            const outward = Math.sin(Math.min(ratio * 2.0, 1.0) * Math.PI * 0.5) * (length * 0.15);
            const downPart = Math.pow(ratio, 2.0) * (length * 1.5);
            v.z += downPart;
            v.y = outward;
            const taper = 1.0 - ratio * 0.3;
            v.x *= taper;
            positions.setXYZ(i, v.x, v.y, v.z);
        }
        positions.needsUpdate = true;
        geo.computeVertexNormals();
    }
}

export class IrregularLeafGenerator implements LeafGenerator {
    constructor(readonly params: IrregularLeafKindParams) { }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseRadius = (1.0 + Math.random() * 0.5) * this.params.size;
        const jitter = baseRadius * 0.25;

        const points: THREE.Vector3[] = [];
        const pointCount = 10;
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < pointCount; i++) {
            points.push(getOffsetSpherePoint(center, baseRadius, jitter));
        }

        let geo: THREE.BufferGeometry = new ConvexGeometry(points);

        if (geo.index) {
            geo = geo.toNonIndexed();
        }
        geo.computeVertexNormals();

        geo.scale(1, this.params.thickness, 1);

        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const matrix = new THREE.Matrix4().compose(leafData.pos, quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const color = new THREE.Color(this.params.color);
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        GraphicsUtils.addVertexColors(geo, color);

        leafGeos.push(geo);
    }
}

export class ClusterLeafGenerator implements LeafGenerator {
    constructor(readonly params: ClusterLeafKindParams) { }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const baseRadius = (1.0 + Math.random() * 0.5) * this.params.size;
        const jitter = baseRadius * 0.25;
        const center = new THREE.Vector3(0, 0, 0);

        const variation = 0.25;
        const numTriangles = Math.max(1, Math.floor(this.params.leaves * (1 + (Math.random() - 0.5) * 2 * variation)));

        const triangleGeos: THREE.BufferGeometry[] = [];

        for (let i = 0; i < numTriangles; i++) {
            const P = getOffsetSpherePoint(center, baseRadius, jitter);
            P.y *= this.params.thickness;
            const Vout = P.clone().normalize();

            const triSize = this.params.leafSize * baseRadius;
            const triGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -triSize / 2, 0, -triSize / 2,
                triSize / 2, 0, -triSize / 2,
                0, 0, triSize / 2
            ]);
            triGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            triGeo.computeVertexNormals();

            const triQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Vout);
            const triMatrix = new THREE.Matrix4().compose(P, triQuat, new THREE.Vector3(1, 1, 1));
            triGeo.applyMatrix4(triMatrix);

            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
            GraphicsUtils.addVertexColors(triGeo, color);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) return;

        const finalQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafData.dir);
        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, finalQuat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        leafGeos.push(mergedTriangles);
    }
}

export class UmbrellaLeafGenerator implements LeafGenerator {
    constructor(readonly params: UmbrellaLeafKindParams) { }

    addLeaves(leafGeos: THREE.BufferGeometry[], leafData: LeafData): void {
        const radius = this.params.size;
        const variation = 0.25;
        const numTriangles = Math.max(1, Math.floor(this.params.leaves * (1 + (Math.random() - 0.5) * 2 * variation)));

        const triangleGeos: THREE.BufferGeometry[] = [];
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < numTriangles; i++) {
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos(Math.random());

            const pos = new THREE.Vector3(
                Math.sin(theta) * Math.cos(phi),
                Math.sin(theta) * Math.sin(phi),
                Math.cos(theta)
            );

            pos.x *= radius * 1.5;
            pos.z *= radius * 1.5;
            pos.y *= radius * 0.4;

            const triSize = this.params.leafSize * radius;
            const triGeo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                -triSize / 2, 0, -triSize / 2,
                triSize / 2, 0, -triSize / 2,
                0, 0, triSize / 2
            ]);
            triGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            triGeo.computeVertexNormals();

            const lookDir = pos.clone().add(new THREE.Vector3(0, 1, 0)).normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookDir);

            const matrix = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
            triGeo.applyMatrix4(matrix);

            const color = new THREE.Color(this.params.color);
            color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
            GraphicsUtils.addVertexColors(triGeo, color);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) return;

        const finalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, finalQuat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        leafGeos.push(mergedTriangles);
    }
}

interface TreeArchetype {
    woodGeo: THREE.BufferGeometry;
    leafGeo: THREE.BufferGeometry;
    kind: LSystemTreeKind;
    variation: number; // 0 to 1
}

export class LSystemTreeFactory implements DecorationFactory {
    private static readonly woodMaterial = new THREE.MeshToonMaterial({ color: 0x4b3621, name: 'LSystemTree - Wood' });
    private static readonly leafMaterial = new THREE.MeshToonMaterial({ color: 0xffffff, name: 'LSystemTree - Leaf', vertexColors: true, side: THREE.DoubleSide });

    private archetypes: Map<LSystemTreeKind, TreeArchetype[]> = new Map();

    async load(): Promise<void> {
        GraphicsUtils.registerObject(LSystemTreeFactory.woodMaterial);
        GraphicsUtils.registerObject(LSystemTreeFactory.leafMaterial);

        const treeGen = new ProceduralTree();

        console.log("--- Tree Archetype Triangle Counts ---");
        for (const kind of Object.keys(ARCHETYPES) as LSystemTreeKind[]) {
            const params = ARCHETYPES[kind];
            const list: TreeArchetype[] = [];
            let totalTriangles = 0;
            let minTriangles = Infinity;
            let maxTriangles = -Infinity;

            for (let i = 0; i < 10; i++) {
                treeGen.generate(params);
                const archetype = this.createArchetype(kind, i / 10, treeGen, params);
                list.push(archetype);

                const triCount = this.getTriangleCount(archetype.woodGeo) + this.getTriangleCount(archetype.leafGeo);
                totalTriangles += triCount;
                minTriangles = Math.min(minTriangles, triCount);
                maxTriangles = Math.max(maxTriangles, triCount);
            }
            this.archetypes.set(kind, list);

            const avg = totalTriangles / 10;
            console.log(`[${kind.toUpperCase()}] Avg: ${avg.toFixed(0)}, Min: ${minTriangles}, Max: ${maxTriangles}`);
        }
        console.log("---------------------------------------");
    }

    private createArchetype(kind: LSystemTreeKind, variation: number, tree: ProceduralTree, params: TreeConfig): TreeArchetype {
        const leafGenerator = this.createLeafGenerator(params);
        const woodGeos: THREE.BufferGeometry[] = [];
        const leafGeos: THREE.BufferGeometry[] = [];

        for (const branch of tree.branches) {
            const height = branch.start.distanceTo(branch.end);
            // Map radius to 3-6 segments. 
            // 0.4+ -> 6 segments, 0.2- -> 3 segments
            const t = Math.max(0.0, Math.min((branch.radiusStart - 0.2) / 0.2, 1.0));
            const radialSegments = Math.floor(3 + 3 * t);
            const geo = new THREE.CylinderGeometry(branch.radiusEnd, branch.radiusStart, height, radialSegments);

            const midpoint = new THREE.Vector3().addVectors(branch.start, branch.end).multiplyScalar(0.5);
            const direction = new THREE.Vector3().subVectors(branch.end, branch.start).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

            const matrix = new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1));
            geo.applyMatrix4(matrix);
            woodGeos.push(geo);
        }

        for (const leaf of tree.leaves) {
            leafGenerator.addLeaves(leafGeos, leaf);
        }

        const mergedWood = this.mergeGeometries(woodGeos, `LSystemWood_${kind}_${variation}`);
        const mergedLeaves = this.mergeGeometries(leafGeos, `LSystemLeaves_${kind}_${variation}`);

        woodGeos.forEach(g => g.dispose());
        leafGeos.forEach(g => g.dispose());

        return { woodGeo: mergedWood, leafGeo: mergedLeaves, kind, variation };
    }

    private getTriangleCount(geo: THREE.BufferGeometry): number {
        if (geo.index) {
            return geo.index.count / 3;
        }
        return geo.attributes.position ? geo.attributes.position.count / 3 : 0;
    }

    private createLeafGenerator(params: TreeConfig): LeafGenerator {
        const leafKind = params.leafKind;
        switch (leafKind.kind) {
            case 'willow':
                return new WillowLeafGenerator(leafKind);
            case 'irregular':
                return new IrregularLeafGenerator(leafKind);
            case 'cluster':
                return new ClusterLeafGenerator(leafKind);
            case 'umbrella':
                return new UmbrellaLeafGenerator(leafKind);
            case 'blob':
            default:
                return new BlobLeafGenerator(leafKind as BlobLeafKindParams);
        }
    }

    private mergeGeometries(geos: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
        if (geos.length === 0) {
            const empty = new THREE.BufferGeometry();
            empty.name = name;
            GraphicsUtils.registerObject(empty);
            return empty;
        }
        const merged = BufferGeometryUtils.mergeGeometries(geos)!;
        merged.name = name;
        GraphicsUtils.registerObject(merged);
        return merged;
    }

    createInstance(options: { kind: LSystemTreeKind, variation?: number }): DecorationInstance[] {
        const { kind, variation = Math.random() } = options;
        const list = this.archetypes.get(kind) || this.archetypes.get('oak')!;

        let best = list[0];
        let minDist = Infinity;
        for (const a of list) {
            const d = Math.abs(a.variation - variation);
            if (d < minDist) {
                minDist = d;
                best = a;
            }
        }

        const woodInstance: DecorationInstance = {
            geometry: best.woodGeo,
            material: LSystemTreeFactory.woodMaterial,
            matrix: new THREE.Matrix4()
        };

        const config = ARCHETYPES[kind];
        if (config && config.trunkColor !== undefined) {
             woodInstance.color = new THREE.Color(config.trunkColor);
        }

        return [
            woodInstance,
            {
                geometry: best.leafGeo,
                material: LSystemTreeFactory.leafMaterial,
                matrix: new THREE.Matrix4()
            }
        ];
    }
}
