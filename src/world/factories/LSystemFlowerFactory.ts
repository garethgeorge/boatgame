import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance, NUM_DECORATION_ARCHETYPES } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import {
    FlowerConfig,
    LSystemFlowerKind,
    ARCHETYPES,
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

import { LeafShader } from '../../shaders/LeafShader';

export interface LSystemFlowerInstanceOptions {
    kind: LSystemFlowerKind;
    variation?: number;
    petalColor?: number;
    centerColor?: number;
    stalkColor?: number;
    scale?: number;
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

        // Vertices for a rectangle (or trapezoid if w0 != w1) made of two triangles.
        // We match PlaneGeometry vertex ordering for consistency with HSL offsets:
        // Vertices 0, 2, 5 are Tip (Base+Length); 1, 3, 4 are Base.
        // x goes from -w to w, y goes from 0 to length
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
        const posAttr = geo.getAttribute('position');
        const localPos = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            hslData[i * 3] = h;
            hslData[i * 3 + 1] = s;

            // Match previous logic: 0, 2, 5 are tip; 1, 3, 4 are base
            const isTip = (i === 0 || i === 2 || i === 3); // Wait, previous comment said 0,2,5 were tip in PlaneGeo
            // Let's check PlaneGeo vertex order for non-indexed 1x1 plane:
            // 0: (-0.5, 0.5), 1: (-0.5, -0.5), 2: (0.5, 0.5)
            // 3: (0.5, 0.5), 4: (-0.5, -0.5), 5: (0.5, -0.5)
            // Tip is Y=0.5 (indices 0, 2, 3), Base is Y=-0.5 (indices 1, 4, 5)
            // My vertices array above: 0: Tip, 1: Base, 2: Tip, 3: Tip, 4: Base, 5: Base
            // So Tip is 0, 2, 3. Base is 1, 4, 5.
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

        // Vertices for a kite made of two triangles, split at the widest point:
        // Triangle 1 (Bottom): (0,0,0), (w/2, widestY, 0), (-w/2, widestY, 0)
        // Triangle 2 (Top): (-w/2, widestY, 0), (w/2, widestY, 0), (0, tipY, tipZ)
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

        // HSL offsets - default to yellow for center as requested
        const h = (Math.random() - 0.5) * (p.variation?.h ?? 0.05);
        const s = (Math.random() - 0.5) * (p.variation?.s ?? 0.1);
        const l = (Math.random() - 0.5) * (p.variation?.l ?? 0.1);
        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l);

        geos.push(geo);
    }
}

interface FlowerArchetype {
    stalkGeo: THREE.BufferGeometry;
    stalkColor?: number;
    petalGeo: THREE.BufferGeometry;
    petalColor?: number;
    centerGeo: THREE.BufferGeometry;
    centerColor?: number;
    kind: LSystemFlowerKind;
    variation: number;
}

export class LSystemFlowerFactory implements DecorationFactory {
    private static readonly stalkMaterial = new THREE.MeshToonMaterial({
        color: 0xffffff,
        name: 'LSystemFlower - Stalk',
        side: THREE.FrontSide
    });
    private static readonly petalMaterial = new THREE.ShaderMaterial({
        ...LeafShader,
        name: 'LSystemFlower - Petal',
        vertexColors: true,
        side: THREE.DoubleSide,
        lights: true,
        fog: true
    });

    private archetypes: Map<LSystemFlowerKind, FlowerArchetype[]> = new Map();

    async load(): Promise<void> {
        GraphicsUtils.registerObject(LSystemFlowerFactory.stalkMaterial);
        GraphicsUtils.registerObject(LSystemFlowerFactory.petalMaterial);

        const plantGen = new ProceduralPlant();

        for (const kind of Object.keys(ARCHETYPES) as LSystemFlowerKind[]) {
            const params = ARCHETYPES[kind];
            const list: FlowerArchetype[] = [];
            let totalTriangles = 0;

            for (let i = 0; i < NUM_DECORATION_ARCHETYPES; i++) {
                plantGen.generate(params);
                const archetype = this.createArchetype(kind, i / NUM_DECORATION_ARCHETYPES, plantGen, params);
                list.push(archetype);
                totalTriangles += this.getTriangleCount(archetype.stalkGeo) + this.getTriangleCount(archetype.petalGeo);
            }
            this.archetypes.set(kind, list);
            console.log(`[FLOWER:${kind.toUpperCase()}] Avg Triangles: ${Math.round(totalTriangles / NUM_DECORATION_ARCHETYPES)}`);
        }
    }

    private getTriangleCount(geo: THREE.BufferGeometry): number {
        if (geo.index) return geo.index.count / 3;
        return geo.attributes.position ? geo.attributes.position.count / 3 : 0;
    }

    private createArchetype(kind: LSystemFlowerKind, variation: number, plant: ProceduralPlant, params: FlowerConfig): FlowerArchetype {
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
            let kind: BranchPartKind = 'cylinder';
            if (branch.opts && branch.opts.kind) {
                kind = branch.opts.kind as BranchPartKind;
            }
            const generator = branchGenerators.get(kind);
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
            stalkGeo: mergedStalk, stalkColor: params.visuals.stalkColor,
            petalGeo: mergedPetals, petalColor: params.visuals.petalColor,
            centerGeo: mergedCenter, centerColor: params.visuals.centerColor,
            kind, variation
        };
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

    private getStalkMaterial(): THREE.MeshToonMaterial {
        return LSystemFlowerFactory.stalkMaterial;
    }

    private getPetalMaterial(): THREE.ShaderMaterial {
        return LSystemFlowerFactory.petalMaterial;
    }

    createInstance(options: LSystemFlowerInstanceOptions): DecorationInstance[] {
        const { kind, variation = Math.random(), petalColor, centerColor, stalkColor, scale = 1.0 } = options;
        const list = this.archetypes.get(kind);
        if (!list) return [];

        let best = list[0];
        let minDist = Infinity;
        for (const a of list) {
            const d = Math.abs(a.variation - variation);
            if (d < minDist) {
                minDist = d;
                best = a;
            }
        }

        const matrix = new THREE.Matrix4();
        if (scale !== 1.0) {
            matrix.makeScale(scale, scale, scale);
        }

        return [
            {
                geometry: best.stalkGeo,
                material: this.getStalkMaterial(),
                matrix: matrix.clone(),
                color: new THREE.Color(stalkColor ?? best.stalkColor ?? 0xffffff)
            },
            {
                geometry: best.petalGeo,
                material: this.getPetalMaterial(),
                matrix: matrix.clone(),
                color: new THREE.Color(petalColor ?? best.petalColor ?? 0xffffff)
            },
            {
                geometry: best.centerGeo,
                material: this.getPetalMaterial(), // Still use petal material for toon shading
                matrix: matrix.clone(),
                color: new THREE.Color(centerColor ?? best.centerColor ?? 0xffffff)
            }
        ];
    }
}
