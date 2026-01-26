import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationFactory, DecorationInstance, NUM_DECORATION_ARCHETYPES } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import {
    FlowerConfig,
    LSystemFlowerKind,
    ARCHETYPES,
    FlowerPartParams,
} from './LSystemFlowerArchetypes';

import {
    ProceduralPlant,
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
    addPart(geos: THREE.BufferGeometry[], data: LeafData, variation: { h: number, s: number, l: number }): void;
}

export class RectanglePetalGenerator implements FlowerPartGenerator {
    constructor(readonly params: FlowerPartParams) { }

    addPart(petalGeos: THREE.BufferGeometry[], petalData: LeafData, variation: { h: number, s: number, l: number }): void {
        const p = this.params as any; // Cast to access petal specific params
        let geo: THREE.BufferGeometry = new THREE.PlaneGeometry(p.size, p.length);
        if (geo.index) geo = geo.toNonIndexed();
        geo.translate(0, p.length / 2, 0); // Rotate around base (now Y axis)

        const matrix = new THREE.Matrix4().compose(petalData.pos, petalData.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // HSL offsets
        const h = (Math.random() - 0.5) * variation.h;
        const s = (Math.random() - 0.5) * variation.s;
        const l = (Math.random() - 0.5) * variation.l;
        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l);

        petalGeos.push(geo);
    }
}

export class KitePetalGenerator implements FlowerPartGenerator {
    constructor(readonly params: FlowerPartParams) { }

    addPart(petalGeos: THREE.BufferGeometry[], petalData: LeafData, variation: { h: number, s: number, l: number }): void {
        const p = this.params as any; // Cast to access kite specific params
        const w = p.width;
        const l = p.length;
        const f = p.widestPointFraction;

        // Vertices for a kite made of two triangles:
        // Triangle 1: (0,0), (-w/2, l*f), (0, l)
        // Triangle 2: (0,0), (0, l), (w/2, l*f)
        const vertices = new Float32Array([
            0, 0, 0,
            -w / 2, l * f, 0,
            0, l, 0,

            0, 0, 0,
            0, l, 0,
            w / 2, l * f, 0
        ]);

        let geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.computeVertexNormals();

        const matrix = new THREE.Matrix4().compose(petalData.pos, petalData.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // HSL offsets
        const h = (Math.random() - 0.5) * variation.h;
        const s = (Math.random() - 0.5) * variation.s;
        const l_hsl = (Math.random() - 0.5) * variation.l;
        GraphicsUtils.addVertexAttribute(geo, 'hslOffset', h, s, l_hsl);

        petalGeos.push(geo);
    }
}

export class FlowerCenterGenerator implements FlowerPartGenerator {
    constructor(readonly params: FlowerPartParams) { }

    addPart(geos: THREE.BufferGeometry[], data: LeafData, variation: { h: number, s: number, l: number }): void {
        const p = this.params as any; // Cast to access center specific params
        let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(p.size, 1);
        if (geo.index) geo = geo.toNonIndexed();
        geo.scale(1, p.thickness / p.size, 1);

        if (p.offset) {
            geo.translate(0, p.offset, 0);
        }

        const matrix = new THREE.Matrix4().compose(data.pos, data.quat, new THREE.Vector3(1, 1, 1));
        geo.applyMatrix4(matrix);

        // HSL offsets - default to yellow for center as requested
        const h = (Math.random() - 0.5) * variation.h;
        const s = (Math.random() - 0.5) * variation.s;
        const l = (Math.random() - 0.5) * variation.l;
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
        const generators: Map<string, FlowerPartGenerator> = new Map();

        const petalParams = params.visuals.petals;
        if (petalParams.kind === 'rectangle') {
            generators.set('petal', new RectanglePetalGenerator(petalParams));
        } else if (petalParams.kind === 'kite') {
            generators.set('petal', new KitePetalGenerator(petalParams));
        }

        if (params.visuals.center) {
            generators.set('center', new FlowerCenterGenerator(params.visuals.center));
        }

        const stalkGeos: THREE.BufferGeometry[] = [];
        const petalGeos: THREE.BufferGeometry[] = [];
        const centerGeos: THREE.BufferGeometry[] = [];

        for (const branch of plant.branches) {
            const height = branch.start.distanceTo(branch.end);
            const geo = new THREE.CylinderGeometry(
                branch.radiusEnd, branch.radiusStart, height,
                5, 1, true);

            const midpoint = new THREE.Vector3().addVectors(branch.start, branch.end).multiplyScalar(0.5);
            const direction = new THREE.Vector3().subVectors(branch.end, branch.start).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

            const matrix = new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1));
            geo.applyMatrix4(matrix);
            stalkGeos.push(geo);
        }

        for (const leaf of plant.leaves) {
            const varHSL = params.visuals.leafVariation || { h: 0.05, s: 0.1, l: 0.1 };
            const generator = generators.get(leaf.kind);
            if (generator) {
                const targetGeos = leaf.kind === 'center' ? centerGeos : petalGeos;
                generator.addPart(targetGeos, leaf, varHSL);
            }
        }

        const mergedStalk = this.mergeGeometries(stalkGeos, `LSystemStalk_${kind}_${variation}`);
        const mergedPetals = this.mergeGeometries(petalGeos, `LSystemPetals_${kind}_${variation}`);
        const mergedCenter = this.mergeGeometries(centerGeos, `LSystemCenter_${kind}_${variation}`);

        stalkGeos.forEach(g => g.dispose());
        petalGeos.forEach(g => g.dispose());
        centerGeos.forEach(g => g.dispose());

        return {
            stalkGeo: mergedStalk, stalkColor: params.visuals.woodColor,
            petalGeo: mergedPetals, petalColor: params.visuals.leafColor,
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
