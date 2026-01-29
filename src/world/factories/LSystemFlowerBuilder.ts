import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import {
    FlowerConfig,
    LSystemFlowerKind,
    FlowerPartParams,
    FlowerPartKind,
    RectangleFlowerPetalParams,
    KiteFlowerPetalParams,
    FlowerCenterParams,
    BranchPartKind,
    BranchPartParams,
    RectangleBranchParams,
} from './LSystemFlowerArchetypes';

import {
    ProceduralPlant,
    BranchData,
    LeafData,
} from './LSystemPlantGenerator';

export interface FlowerGeometryResult {
    stalkGeo: THREE.BufferGeometry;
    petalGeo: THREE.BufferGeometry;
    centerGeo: THREE.BufferGeometry;
}

export interface FlowerPartGenerator {
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void;
}

export interface BranchPartGenerator {
    addPart(geos: THREE.BufferGeometry[], data: BranchData): void;
}

export class CylinderBranchGenerator implements BranchPartGenerator {
    addPart(stalkGeos: THREE.BufferGeometry[], branch: BranchData): void {
        const height = branch.start.distanceTo(branch.end);
        let geo: THREE.BufferGeometry = new THREE.CylinderGeometry(
            branch.radiusEnd, branch.radiusStart, height,
            5, 1, true);
        if (geo.index) geo = geo.toNonIndexed();

        const midpoint = new THREE.Vector3().addVectors(branch.start, branch.end).multiplyScalar(0.5);
        const direction = new THREE.Vector3().subVectors(branch.end, branch.start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

        const matrix = new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // Add dummy hslOffset to match other stalk geometries
        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', 0, 0, 0);

        stalkGeos.push(geo);
    }
}

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

        const vertices = new Float32Array([
            -w1, length, 0, // 0: Tip Left
            -w0, 0, 0,      // 1: Base Left
            w1, length, 0, // 2: Tip Right

            w1, length, 0, // 3: Tip Right
            -w0, 0, 0,      // 4: Base Left
            w0, 0, 0       // 5: Base Right
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

        const matrix = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

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

export class RectanglePetalGenerator implements FlowerPartGenerator {
    addPart(petalGeos: THREE.BufferGeometry[], petalData: LeafData): void {
        const p = petalData.opts as RectangleFlowerPetalParams;
        RectangleGeometryHelper.addRectangle(
            petalGeos,
            p.size, p.size, p.length,
            petalData.pos, petalData.quat,
            p.variation, p.lGradient
        );
    }
}

export class RectangleBranchGenerator implements BranchPartGenerator {
    addPart(stalkGeos: THREE.BufferGeometry[], branch: BranchData): void {
        const p = branch.opts as RectangleBranchParams;
        const length = branch.start.distanceTo(branch.end);
        const direction = new THREE.Vector3().subVectors(branch.end, branch.start).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

        const widthScale = p.widthScale ?? [1, 1];
        RectangleGeometryHelper.addRectangle(
            stalkGeos,
            branch.radiusStart * 2 * widthScale[0],
            branch.radiusEnd * 2 * widthScale[1],
            length,
            branch.start, quaternion,
            p.variation, p.lGradient
        );
    }
}

export class KitePetalGenerator implements FlowerPartGenerator {
    addPart(petalGeos: THREE.BufferGeometry[], petalData: LeafData): void {
        const p = petalData.opts as KiteFlowerPetalParams;
        const w = p.width;
        const l = p.length;
        const f = p.middle;
        const bendDeg = p.bend ?? 0;
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
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6 * 2), 2)); // Add dummy UVs
        geo.computeVertexNormals();

        const matrix = new THREE.Matrix4().compose(petalData.pos, petalData.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // HSL offsets
        const h = (Math.random() - 0.5) * (p.variation?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (p.variation?.s ?? 0.1);
        const random_l = (Math.random() - 0.5) * (p.variation?.l ?? 0.1);
        const base_l = random_l + (p.lGradient?.[0] ?? 0);
        const tip_l = random_l + (p.lGradient?.[1] ?? 0);
        const mid_l = base_l + (tip_l - base_l) * f;

        const hslData = new Float32Array(6 * 3);
        // Vertex 0: Base
        hslData[0] = h; hslData[1] = s; hslData[2] = base_l;
        // Vertex 1: Mid
        hslData[3] = h; hslData[4] = s; hslData[5] = mid_l;
        // Vertex 2: Mid
        hslData[6] = h; hslData[7] = s; hslData[8] = mid_l;
        // Vertex 3: Mid
        hslData[9] = h; hslData[10] = s; hslData[11] = mid_l;
        // Vertex 4: Mid
        hslData[12] = h; hslData[13] = s; hslData[14] = mid_l;
        // Vertex 5: Tip
        hslData[15] = h; hslData[16] = s; hslData[17] = tip_l;

        geo.setAttribute('hslOffset', new THREE.BufferAttribute(hslData, 3));

        petalGeos.push(geo);
    }
}

export class FlowerCenterGenerator implements FlowerPartGenerator {
    addPart(geos: THREE.BufferGeometry[], data: LeafData): void {
        const p = data.opts as FlowerCenterParams;
        let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(p.size, 1);
        if (geo.index) geo = geo.toNonIndexed();
        geo.scale(1, p.thickness / p.size, 1);

        if (p.offset) {
            geo.translate(0, p.offset, 0);
        }

        const matrix = new THREE.Matrix4().compose(data.pos, data.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        const h = (Math.random() - 0.5) * (p.variation?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (p.variation?.s ?? 0.1);
        const l = (Math.random() - 0.5) * (p.variation?.l ?? 0.1);
        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l);

        geos.push(geo);
    }
}

export class LSystemFlowerBuilder {
    static createArchetype(kind: LSystemFlowerKind, variation: number, plant: ProceduralPlant, params: FlowerConfig): FlowerGeometryResult {
        const petalGenerators: Map<FlowerPartKind, FlowerPartGenerator> = new Map();
        petalGenerators.set('rectangle', new RectanglePetalGenerator());
        petalGenerators.set('kite', new KitePetalGenerator());
        petalGenerators.set('center', new FlowerCenterGenerator());

        const branchGenerators: Map<BranchPartKind, BranchPartGenerator> = new Map();
        branchGenerators.set('cylinder', new CylinderBranchGenerator());
        branchGenerators.set('rectangle', new RectangleBranchGenerator());

        const stalkGeos: THREE.BufferGeometry[] = [];
        const petalGeos: THREE.BufferGeometry[] = [];
        const centerGeos: THREE.BufferGeometry[] = [];

        for (const branch of plant.branches) {
            let branchKind: BranchPartKind = 'cylinder';
            if (branch.opts && branch.opts.kind) {
                branchKind = branch.opts.kind as BranchPartKind;
            }
            const generator = branchGenerators.get(branchKind);
            if (generator) {
                generator.addPart(stalkGeos, branch);
            }
        }

        for (const leaf of plant.leaves) {
            if (leaf.opts !== undefined) {
                const part = leaf.opts as FlowerPartParams;
                const generator = petalGenerators.get(part.kind);
                if (generator) {
                    const targetGeos = part.kind === 'center' ? centerGeos : petalGeos;
                    generator.addPart(targetGeos, leaf);
                }
            }
        }

        const mergedStalk = this.mergeGeometries(stalkGeos, `LSystemStalk_${kind}_${variation}`);
        const mergedPetals = this.mergeGeometries(petalGeos, `LSystemPetals_${kind}_${variation}`);
        const mergedCenter = this.mergeGeometries(centerGeos, `LSystemCenter_${kind}_${variation}`);

        stalkGeos.forEach(g => g.dispose());
        petalGeos.forEach(g => g.dispose());
        centerGeos.forEach(g => g.dispose());

        return {
            stalkGeo: mergedStalk,
            petalGeo: mergedPetals,
            centerGeo: mergedCenter
        };
    }

    private static mergeGeometries(geos: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
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
