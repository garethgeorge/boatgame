import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { ProceduralPlant, BranchData, LeafData, } from './LSystemPlantGenerator';
import { BlobLeafKindParams, ClusterLeafKindParams, CylinderBranchParams, FlowerCenterParams, IrregularLeafKindParams, KiteFlowerPetalParams, RectangleBranchParams, RectangleFlowerPetalParams, UmbrellaLeafKindParams, WillowLeafKindParams } from './LSystemPartParams';


export interface PlantGeometryResult {
    // Primary geometries (e.g., wood for trees, stalk for flowers)
    primaryGeo: THREE.BufferGeometry;
    // Secondary geometries (e.g., leaves for trees, petals for flowers)
    secondaryGeo: THREE.BufferGeometry;
    // Optional tertiary geometries (e.g., flower centers)
    tertiaryGeo?: THREE.BufferGeometry;

    // For trees, indicates if leaves can be culled for performance
    canCullSecondary?: boolean;
}

export interface PlantPartGenerator {
    // true => this geometry is closed and so culling based on triangle facing
    // can be used
    readonly canCull: boolean;
    addPart(geos: THREE.BufferGeometry[], data: LeafData | BranchData): void;
}

// --- Helper Functions ---

const getOffsetSpherePoint = (center: THREE.Vector3, baseRadius: number, jitter: number): THREE.Vector3 => {
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
};

export class RectangleGeometryHelper {
    static addRectangle(
        geos: THREE.BufferGeometry[],
        widthStart: number,
        widthEnd: number,
        length: number,
        pos: THREE.Vector3,
        quat: THREE.Quaternion,
        variation?: { h: number, s: number, l: number },
        lGradient?: [number, number]
    ): void {
        const w0 = widthStart / 2;
        const w1 = widthEnd / 2;

        const vBaseL = new THREE.Vector3(-w0, 0, 0).applyQuaternion(quat).add(pos);
        const vBaseR = new THREE.Vector3(w0, 0, 0).applyQuaternion(quat).add(pos);
        const vTipL = new THREE.Vector3(-w1, length, 0).applyQuaternion(quat).add(pos);
        const vTipR = new THREE.Vector3(w1, length, 0).applyQuaternion(quat).add(pos);

        this.addRectangleCustom(geos, vTipL, vBaseL, vTipR, vBaseR, variation, lGradient);
    }

    static addRectangleCustom(
        geos: THREE.BufferGeometry[],
        vTipL: THREE.Vector3,
        vBaseL: THREE.Vector3,
        vTipR: THREE.Vector3,
        vBaseR: THREE.Vector3,
        variation?: { h: number, s: number, l: number },
        lGradient?: [number, number]
    ): void {
        const vertices = new Float32Array([
            vTipL.x, vTipL.y, vTipL.z, // 0: Tip Left
            vBaseL.x, vBaseL.y, vBaseL.z, // 1: Base Left
            vTipR.x, vTipR.y, vTipR.z, // 2: Tip Right

            vTipR.x, vTipR.y, vTipR.z, // 3: Tip Right
            vBaseL.x, vBaseL.y, vBaseL.z, // 4: Base Left
            vBaseR.x, vBaseR.y, vBaseR.z  // 5: Base Right
        ]);

        const uvs = new Float32Array([
            0, 1,
            0, 0,
            1, 1,

            1, 1,
            0, 0,
            1, 0
        ]);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.computeVertexNormals();

        // No matrix apply needed here as vertices are already in world space

        // HSL offsets
        const h = (Math.random() - 0.5) * (variation?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (variation?.s ?? 0.1);
        const random_l = (Math.random() - 0.5) * (variation?.l ?? 0.1);
        const base_l = random_l + (lGradient?.[0] ?? 0);
        const tip_l = random_l + (lGradient?.[1] ?? 0);

        const count = geo.attributes.position.count;
        const hslData = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            hslData[i * 3] = h;
            hslData[i * 3 + 1] = s;

            const vertexIsTip = (i === 0 || i === 2 || i === 3);
            hslData[i * 3 + 2] = vertexIsTip ? tip_l : base_l;
        }
        geo.setAttribute('hslOffset', new THREE.BufferAttribute(hslData, 3));

        geos.push(geo);
    }
}

// --- Branch Generators ---

export class CylinderBranchGenerator implements PlantPartGenerator {
    readonly canCull: boolean = true;
    addPart(geos: THREE.BufferGeometry[], data: BranchData): void {
        const branch = data as BranchData;

        // Calculate segments based on radius (consistent with previous implementation)
        const t = Math.max(0.0, Math.min((branch.radiusStart - 0.2) / 0.2, 1.0));
        const radialSegments = Math.floor(3 + 3 * t);

        // To ensure seamless joining, we manually build the cylinder rings
        const ringBase: THREE.Vector3[] = [];
        const ringTip: THREE.Vector3[] = [];

        for (let i = 0; i <= radialSegments; i++) {
            const theta = (i / radialSegments) * Math.PI * 2;
            const cos = Math.cos(theta);
            const sin = Math.sin(theta);
            const localV = new THREE.Vector3(cos, 0, sin);

            // Base Ring vertex (start of branch)
            let vBase: THREE.Vector3;
            const vCurrBase = localV.clone().multiplyScalar(branch.radiusStart).applyQuaternion(branch.quat);
            if (branch.prev) {
                const vPrevEnd = localV.clone().multiplyScalar(branch.prev.radiusEnd).applyQuaternion(branch.prev.quat);
                vBase = branch.start.clone().add(vCurrBase.add(vPrevEnd).multiplyScalar(0.5));
            } else {
                vBase = branch.start.clone().add(vCurrBase);
            }
            ringBase.push(vBase);

            // Tip Ring vertex (end of branch)
            let vTip: THREE.Vector3;
            const vCurrTip = localV.clone().multiplyScalar(branch.radiusEnd).applyQuaternion(branch.quat);
            if (branch.next) {
                const vNextStart = localV.clone().multiplyScalar(branch.next.radiusStart).applyQuaternion(branch.next.quat);
                vTip = branch.end.clone().add(vCurrTip.add(vNextStart).multiplyScalar(0.5));
            } else {
                vTip = branch.end.clone().add(vCurrTip);
            }
            ringTip.push(vTip);
        }

        // Build geometry (triangles)
        const vertices = new Float32Array(radialSegments * 6 * 3);
        const uvs = new Float32Array(radialSegments * 6 * 2);

        for (let i = 0; i < radialSegments; i++) {
            const b0 = ringBase[i];
            const b1 = ringBase[i + 1];
            const t0 = ringTip[i];
            const t1 = ringTip[i + 1];

            const idx = i * 6 * 3;
            const uidx = i * 6 * 2;

            // Face triangles (CCW)
            // Triangle 1
            vertices[idx + 0] = b0.x; vertices[idx + 1] = b0.y; vertices[idx + 2] = b0.z;
            vertices[idx + 3] = t1.x; vertices[idx + 4] = t1.y; vertices[idx + 5] = t1.z;
            vertices[idx + 6] = t0.x; vertices[idx + 7] = t0.y; vertices[idx + 8] = t0.z;

            // Triangle 2
            vertices[idx + 9] = b0.x; vertices[idx + 10] = b0.y; vertices[idx + 11] = b0.z;
            vertices[idx + 12] = b1.x; vertices[idx + 13] = b1.y; vertices[idx + 14] = b1.z;
            vertices[idx + 15] = t1.x; vertices[idx + 16] = t1.y; vertices[idx + 17] = t1.z;

            const u0 = i / radialSegments;
            const u1 = (i + 1) / radialSegments;
            uvs[uidx + 0] = u0; uvs[uidx + 1] = 0;
            uvs[uidx + 2] = u1; uvs[uidx + 3] = 1;
            uvs[uidx + 4] = u0; uvs[uidx + 5] = 1;

            uvs[uidx + 6] = u0; uvs[uidx + 7] = 0;
            uvs[uidx + 8] = u1; uvs[uidx + 9] = 0;
            uvs[uidx + 10] = u1; uvs[uidx + 11] = 1;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.computeVertexNormals();

        // Calculate HSL offsets
        const opts = (branch.opts || {}) as CylinderBranchParams;
        const h = (Math.random() - 0.5) * (opts.variation?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (opts.variation?.s ?? 0.1);
        const l = (Math.random() - 0.5) * (opts.variation?.l ?? 0.1);
        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l);

        geos.push(geo);
    }
}

export class RectangleBranchGenerator implements PlantPartGenerator {
    readonly canCull: boolean = false;
    addPart(geos: THREE.BufferGeometry[], data: BranchData): void {
        const branch = data as BranchData;
        const opts = (branch.opts || {}) as RectangleBranchParams;
        const widthScale = opts.widthScale ?? [1, 1];

        const w0 = branch.radiusStart * 2 * widthScale[0];
        const w1 = branch.radiusEnd * 2 * widthScale[1];

        // 1. Current branch half-width vectors (local X direction)
        const vCurrBase = new THREE.Vector3(w0 / 2, 0, 0).applyQuaternion(branch.quat);
        const vCurrTip = new THREE.Vector3(w1 / 2, 0, 0).applyQuaternion(branch.quat);

        // 2. Base vertices (start of branch)
        let vBaseL: THREE.Vector3;
        let vBaseR: THREE.Vector3;

        if (branch.prev) {
            const prevOpts = (branch.prev.opts || {}) as RectangleBranchParams;
            const prevWidthScale = prevOpts.widthScale ?? [1, 1];
            const wPrevEnd = branch.prev.radiusEnd * 2 * prevWidthScale[1];
            const vPrevEnd = new THREE.Vector3(wPrevEnd / 2, 0, 0).applyQuaternion(branch.prev.quat);

            // Interpolate halfway between previous tip and current base
            const joinedHalfWidth = new THREE.Vector3().addVectors(vCurrBase, vPrevEnd).multiplyScalar(0.5);
            vBaseL = branch.start.clone().sub(joinedHalfWidth);
            vBaseR = branch.start.clone().add(joinedHalfWidth);
        } else {
            vBaseL = branch.start.clone().sub(vCurrBase);
            vBaseR = branch.start.clone().add(vCurrBase);
        }

        // 3. Tip vertices (end of branch)
        let vTipL: THREE.Vector3;
        let vTipR: THREE.Vector3;

        if (branch.next) {
            const nextOpts = (branch.next.opts || {}) as RectangleBranchParams;
            const nextWidthScale = nextOpts.widthScale ?? [1, 1];
            const wNextStart = branch.next.radiusStart * 2 * nextWidthScale[0];
            const vNextStart = new THREE.Vector3(wNextStart / 2, 0, 0).applyQuaternion(branch.next.quat);

            // Interpolate halfway between current tip and next base
            const joinedHalfWidth = new THREE.Vector3().addVectors(vCurrTip, vNextStart).multiplyScalar(0.5);
            vTipL = branch.end.clone().sub(joinedHalfWidth);
            vTipR = branch.end.clone().add(joinedHalfWidth);
        } else {
            vTipL = branch.end.clone().sub(vCurrTip);
            vTipR = branch.end.clone().add(vCurrTip);
        }

        RectangleGeometryHelper.addRectangleCustom(
            geos,
            vTipL, vBaseL, vTipR, vBaseR,
            opts.variation, opts.lGradient
        );
    }
}

// --- Leaf / Part Generators ---

export class BlobLeafGenerator implements PlantPartGenerator {
    readonly canCull = true;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const leafData = data as LeafData;
        const opts = (leafData.opts || {}) as BlobLeafKindParams;
        const baseSize = (1.0 + Math.random() * 0.5) * (opts.size ?? 1.0);
        let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(baseSize, 0);

        if (geo.index) geo = geo.toNonIndexed();
        geo.computeVertexNormals();

        geo.scale(1, opts.thickness ?? 1.0, 1);

        const matrix = new THREE.Matrix4().compose(leafData.pos, leafData.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // Calculate HSL offsets
        const v = opts.variation;
        const h = (Math.random() - 0.5) * (v?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (v?.s ?? 0.1);
        const l = (Math.random() - 0.5) * (v?.l ?? 0.1);

        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l);

        geos.push(geo);
    }
}

export class WillowLeafGenerator implements PlantPartGenerator {
    readonly canCull = true;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const leafData = data as LeafData;
        const opts = (leafData.opts || {}) as WillowLeafKindParams;
        const strandCount = opts.strands ?? 3;
        const targetGroundClearance = 2.0;

        for (let i = 0; i < strandCount; i++) {
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

            // Calculate HSL offsets
            const v = opts.variation;
            const h = (Math.random() - 0.5) * (v?.h ?? 0.05);
            const s = (Math.random() - 0.5) * (v?.s ?? 0.1);
            const l = (Math.random() - 0.5) * (v?.l ?? 0.1);

            GraphicsUtils.addVertexAttribute(strandGeo, 'hslOffset', h, s, l);

            geos.push(strandGeo);
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

export class IrregularLeafGenerator implements PlantPartGenerator {
    readonly canCull = true;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const leafData = data as LeafData;
        const opts = (leafData.opts || {}) as IrregularLeafKindParams;
        const baseRadius = (1.0 + Math.random() * 0.5) * (opts.size ?? 1.0);
        const jitter = baseRadius * 0.25;

        const points: THREE.Vector3[] = [];
        const pointCount = 10;
        const center = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < pointCount; i++) {
            points.push(getOffsetSpherePoint(center, baseRadius, jitter));
        }

        let geo: THREE.BufferGeometry = new ConvexGeometry(points);

        if (geo.index) geo = geo.toNonIndexed();
        geo.computeVertexNormals();

        geo.scale(1, opts.thickness ?? 1.0, 1);

        const matrix = new THREE.Matrix4().compose(leafData.pos, leafData.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // Calculate HSL offsets
        const v = opts.variation;
        const h = (Math.random() - 0.5) * (v?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (v?.s ?? 0.1);
        const l = (Math.random() - 0.5) * (v?.l ?? 0.1);

        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l);

        geos.push(geo);
    }
}

export class ClusterLeafGenerator implements PlantPartGenerator {
    readonly canCull = false;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const leafData = data as LeafData;
        const opts = (leafData.opts || {}) as ClusterLeafKindParams;
        const baseRadius = (1.0 + Math.random() * 0.5) * (opts.size ?? 1.0);
        const jitter = baseRadius * 0.25;
        const center = new THREE.Vector3(0, 0, 0);

        const countVariation = 0.25;
        const numTriangles = Math.max(1, Math.floor((opts.leaves ?? 10) * (1 + (Math.random() - 0.5) * 2 * countVariation)));

        const triangleGeos: THREE.BufferGeometry[] = [];

        for (let i = 0; i < numTriangles; i++) {
            const P = getOffsetSpherePoint(center, baseRadius, jitter);
            P.y *= (opts.thickness ?? 1.0);
            const Vout = P.clone().normalize();

            const triSize = (opts.leafSize ?? 0.5) * baseRadius;
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

            const v = opts.variation;
            const h = (Math.random() - 0.5) * (v?.h ?? 0.05);
            const s = (Math.random() - 0.5) * (v?.s ?? 0.1);
            const l = (Math.random() - 0.5) * (v?.l ?? 0.1);

            GraphicsUtils.addVertexAttribute(triGeo, 'hslOffset', h, s, l);
            GraphicsUtils.registerObject(triGeo);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) {
            triangleGeos.forEach(g => GraphicsUtils.disposeObject(g));
            return;
        }
        mergedTriangles.name = 'ClusterGenerator - merged';
        GraphicsUtils.registerObject(mergedTriangles);

        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, leafData.quat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        geos.push(mergedTriangles);
        triangleGeos.forEach(g => GraphicsUtils.disposeObject(g));
    }
}

export class UmbrellaLeafGenerator implements PlantPartGenerator {
    readonly canCull = false;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const leafData = data as LeafData;
        const opts = (leafData.opts || {}) as UmbrellaLeafKindParams;
        const radius = opts.size ?? 1.0;
        const countVariation = 0.25;
        const numTriangles = Math.max(1, Math.floor((opts.leaves ?? 10) * (1 + (Math.random() - 0.5) * 2 * countVariation)));

        const triangleGeos: THREE.BufferGeometry[] = [];

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

            const triSize = (opts.leafSize ?? 0.5) * radius;
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

            const v = opts.variation;
            const h = (Math.random() - 0.5) * (v?.h ?? 0.05);
            const s = (Math.random() - 0.5) * (v?.s ?? 0.1);
            const l = (Math.random() - 0.5) * (v?.l ?? 0.1);

            GraphicsUtils.addVertexAttribute(triGeo, 'hslOffset', h, s, l);
            GraphicsUtils.registerObject(triGeo);

            triangleGeos.push(triGeo);
        }

        if (triangleGeos.length === 0) return;

        let mergedTriangles = BufferGeometryUtils.mergeGeometries(triangleGeos);
        if (!mergedTriangles) {
            triangleGeos.forEach(g => GraphicsUtils.disposeObject(g));
            return;
        }
        mergedTriangles.name = 'UmbrellaGenerator - merged';
        GraphicsUtils.registerObject(mergedTriangles);

        const finalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        const finalMatrix = new THREE.Matrix4().compose(leafData.pos, finalQuat, new THREE.Vector3(1, 1, 1));
        mergedTriangles.applyMatrix4(finalMatrix);

        geos.push(mergedTriangles);
        triangleGeos.forEach(g => GraphicsUtils.disposeObject(g));
    }
}

export class RectanglePetalGenerator implements PlantPartGenerator {
    readonly canCull = false;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const petalData = data as LeafData;
        const opts = (petalData.opts || {}) as RectangleFlowerPetalParams;
        RectangleGeometryHelper.addRectangle(
            geos,
            opts.size ?? 1.0, opts.size ?? 1.0, opts.length ?? 1.0,
            petalData.pos, petalData.quat,
            opts.variation, opts.lGradient
        );
    }
}

export class KitePetalGenerator implements PlantPartGenerator {
    readonly canCull = false;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const petalData = data as LeafData;
        const opts = (petalData.opts || {}) as KiteFlowerPetalParams;
        const w = opts.width ?? 1.0;
        const l = opts.length ?? 1.0;
        const f = opts.middle ?? 0.5;
        const bendDeg = opts.bend ?? 0;
        const bendRad = bendDeg * (Math.PI / 180);

        const widestY = l * f;
        const tipDist = l * (1 - f);
        const tipY = widestY + tipDist * Math.cos(bendRad);
        const tipZ = tipDist * Math.sin(bendRad);

        const vertices = new Float32Array([
            0, 0, 0,
            w / 2, widestY, 0,
            -w / 2, widestY, 0,

            -w / 2, widestY, 0,
            w / 2, widestY, 0,
            0, tipY, tipZ
        ]);

        let geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6 * 2), 2));
        geo.computeVertexNormals();

        const matrix = new THREE.Matrix4().compose(petalData.pos, petalData.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // HSL offsets
        const v = opts.variation;
        const h = (Math.random() - 0.5) * (v?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (v?.s ?? 0.1);
        const random_l = (Math.random() - 0.5) * (v?.l ?? 0.1);
        const base_l = random_l + (opts.lGradient?.[0] ?? 0);
        const tip_l = random_l + (opts.lGradient?.[1] ?? 0);
        const mid_l = base_l + (tip_l - base_l) * f;

        const hslData = new Float32Array(6 * 3);
        hslData[0] = h; hslData[1] = s; hslData[2] = base_l;
        hslData[3] = h; hslData[4] = s; hslData[5] = mid_l;
        hslData[6] = h; hslData[7] = s; hslData[8] = mid_l;
        hslData[9] = h; hslData[10] = s; hslData[11] = mid_l;
        hslData[12] = h; hslData[13] = s; hslData[14] = mid_l;
        hslData[15] = h; hslData[16] = s; hslData[17] = tip_l;

        geo.setAttribute('hslOffset', new THREE.BufferAttribute(hslData, 3));

        geos.push(geo);
    }
}

export class FlowCenterGenerator implements PlantPartGenerator {
    readonly canCull: boolean = true;
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const opts = (data.opts || {}) as FlowerCenterParams;
        const size = opts.size ?? 0.5;
        let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(size, 1);
        if (geo.index) geo = geo.toNonIndexed();
        geo.scale(1, (opts.thickness ?? size) / size, 1);

        if (opts.offset) {
            geo.translate(0, opts.offset, 0);
        }

        const matrix = new THREE.Matrix4().compose(data.pos, data.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const v = opts.variation;
        const h = (Math.random() - 0.5) * (v?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (v?.s ?? 0.1);
        const l = (Math.random() - 0.5) * (v?.l ?? 0.1);
        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l);

        geos.push(geo);
    }
}

// --- Main Builder ---

export class LSystemPlantBuilder {
    private static leafGenerators: Map<string, PlantPartGenerator> = new Map([
        ['blob', new BlobLeafGenerator()],
        ['willow', new WillowLeafGenerator()],
        ['irregular', new IrregularLeafGenerator()],
        ['cluster', new ClusterLeafGenerator()],
        ['umbrella', new UmbrellaLeafGenerator()],
        ['rectangle', new RectanglePetalGenerator()],
        ['kite', new KitePetalGenerator()],
        ['center', new FlowCenterGenerator()],
    ]);

    private static branchGenerators: Map<string, PlantPartGenerator> = new Map([
        ['cylinder', new CylinderBranchGenerator()],
        ['rectangle', new RectangleBranchGenerator()],
    ]);

    static build(
        name: string,
        plant: ProceduralPlant,
        defaultLeaf: any
    ): PlantGeometryResult {
        const geos: THREE.BufferGeometry[][] = [[], [], []];
        const cull: boolean[] = [true, true, true];

        // 1. Process Branches
        for (const branch of plant.branches) {
            const kind = branch.opts?.kind || 'cylinder';
            const generator = this.branchGenerators.get(kind);
            if (generator) {
                const geomIndex = branch.geomIndex ?? 0;
                generator.addPart(geos[geomIndex], branch);
                if (!generator.canCull)
                    cull[geomIndex] = false;
            }
        }

        // 2. Process Leaves / Parts
        for (const leaf of plant.leaves) {
            if (leaf.opts === undefined)
                leaf.opts = defaultLeaf;
            const kind = leaf.opts?.kind || 'blob';
            const generator = this.leafGenerators.get(kind);
            if (generator) {
                const geomIndex = leaf.geomIndex ?? 1;
                generator.addPart(geos[geomIndex], leaf);
                if (!generator.canCull)
                    cull[geomIndex] = false;
            }
        }

        const mergedPrimary = this.mergeAndName(geos[0], `${name}_primary`);
        const mergedSecondary = this.mergeAndName(geos[1], `${name}_secondary`);
        const result: PlantGeometryResult = {
            primaryGeo: mergedPrimary,
            secondaryGeo: mergedSecondary,
            canCullSecondary: cull[1]
        };

        if (geos[2].length > 0) {
            result.tertiaryGeo = this.mergeAndName(geos[2], `${name}_tertiary`);
        }

        // Cleanup
        geos.flat().forEach(g => g.dispose());

        return result;
    }

    private static mergeAndName(geos: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
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
}
