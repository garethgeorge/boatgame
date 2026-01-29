import * as THREE from 'three';
import { DecorationFactory, DecorationInstance, NUM_DECORATION_ARCHETYPES } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import {
    FlowerConfig,
    LSystemFlowerKind,
    ARCHETYPES,
} from './LSystemFlowerArchetypes';

import {
    ProceduralPlant,
} from './LSystemPlantGenerator';

import { LSystemFlowerBuilder } from './LSystemFlowerBuilder';
import { LeafShader } from '../../shaders/LeafShader';

export interface LSystemFlowerInstanceOptions {
    kind: LSystemFlowerKind;
    variation?: number;
    petalColor?: number;
    centerColor?: number;
    stalkColor?: number;
    scale?: number;
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
                const variation = i / (NUM_DECORATION_ARCHETYPES || 10);
                const result = LSystemFlowerBuilder.createArchetype(kind, variation, plantGen, params);

                const archetype: FlowerArchetype = {
                    stalkGeo: result.stalkGeo,
                    stalkColor: params.visuals.stalkColor,
                    petalGeo: result.petalGeo,
                    petalColor: params.visuals.petalColor,
                    centerGeo: result.centerGeo,
                    centerColor: params.visuals.centerColor,
                    kind,
                    variation
                };

                list.push(archetype);
                totalTriangles += this.getTriangleCount(archetype.stalkGeo) + this.getTriangleCount(archetype.petalGeo);
            }
            this.archetypes.set(kind, list);
            console.log(`[FLOWER:${kind.toUpperCase()}] Avg Triangles: ${Math.round(totalTriangles / (NUM_DECORATION_ARCHETYPES || 10))}`);
        }
    }

    private getTriangleCount(geo: THREE.BufferGeometry): number {
        if (geo.index) return geo.index.count / 3;
        return geo.attributes.position ? geo.attributes.position.count / 3 : 0;
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
