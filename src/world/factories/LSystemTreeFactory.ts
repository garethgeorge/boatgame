import * as THREE from 'three';
import { DecorationFactory, DecorationInstance, NUM_DECORATION_ARCHETYPES } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import {
    TreeConfig,
    LSystemTreeKind,
    ARCHETYPES,
} from './LSystemTreeArchetypes';

import {
    ProceduralPlant,
} from './LSystemPlantGenerator';

import { LSystemPlantBuilder } from './LSystemPlantBuilder';
import { LeafShader } from '../../shaders/LeafShader';

export interface LSystemTreeInstanceOptions {
    kind: LSystemTreeKind;
    variation?: number;
    isSnowy?: boolean;
    leafColor?: number;
    woodColor?: number;
    scale?: number;
    isLeafLess?: boolean;
}

interface TreeArchetype {
    woodGeo: THREE.BufferGeometry;
    woodColor?: number;
    leafGeo: THREE.BufferGeometry;
    leafColor?: number;
    kind: LSystemTreeKind;
    variation: number; // 0 to 1
    canCullLeaves: boolean;
}

export class LSystemTreeFactory implements DecorationFactory {
    private static readonly woodMaterial = new THREE.MeshToonMaterial({
        color: 0xffffff,
        name: 'LSystemTree - Wood',
        side: THREE.FrontSide
    });
    private static readonly leafMaterial = new THREE.ShaderMaterial({
        ...LeafShader,
        name: 'LSystemTree - Leaf',
        vertexColors: true,
        side: THREE.FrontSide, // Default to back-face culling for performance
        lights: true,
        fog: true
    });

    private archetypes: Map<LSystemTreeKind, TreeArchetype[]> = new Map();

    async load(): Promise<void> {
        GraphicsUtils.registerObject(LSystemTreeFactory.woodMaterial);
        GraphicsUtils.registerObject(LSystemTreeFactory.leafMaterial);

        const treeGen = new ProceduralPlant();

        console.log("--- Tree Archetype Triangle Counts ---");
        for (const kind of Object.keys(ARCHETYPES) as LSystemTreeKind[]) {
            const params = ARCHETYPES[kind];
            const list: TreeArchetype[] = [];
            let totalTriangles = 0;
            let minTriangles = Infinity;
            let maxTriangles = -Infinity;

            for (let i = 0; i < NUM_DECORATION_ARCHETYPES; i++) {
                treeGen.generate(params);
                const variation = i / (NUM_DECORATION_ARCHETYPES || 10);
                const result = LSystemPlantBuilder.build(
                    `LSystemTree_${kind}_${variation}`,
                    treeGen,
                    params.visuals.leafKind
                );

                const archetype: TreeArchetype = {
                    woodGeo: result.primaryGeo,
                    woodColor: params.visuals.woodColor,
                    leafGeo: result.secondaryGeo,
                    leafColor: params.visuals.leafColor,
                    kind,
                    variation,
                    canCullLeaves: result.canCullSecondary ?? true
                };

                list.push(archetype);

                const triCount = this.getTriangleCount(archetype.woodGeo) + this.getTriangleCount(archetype.leafGeo);
                totalTriangles += triCount;
                minTriangles = Math.min(minTriangles, triCount);
                maxTriangles = Math.max(maxTriangles, triCount);
            }
            this.archetypes.set(kind, list);

            const avg = totalTriangles / (NUM_DECORATION_ARCHETYPES || 10);
            console.log(`[${kind.toUpperCase()}] Avg: ${avg.toFixed(0)}, Min: ${minTriangles}, Max: ${maxTriangles}`);
        }
        console.log("---------------------------------------");
    }

    private getTriangleCount(geo: THREE.BufferGeometry): number {
        if (geo.index) {
            return geo.index.count / 3;
        }
        return geo.attributes.position ? geo.attributes.position.count / 3 : 0;
    }

    private getWoodMaterial(): THREE.MeshToonMaterial {
        return LSystemTreeFactory.woodMaterial;
    }

    private getLeafMaterial(isSnowy: boolean = false, side: THREE.Side = THREE.FrontSide): THREE.ShaderMaterial {
        const key = `${isSnowy}_${side}`;
        if (!this['structuralLeafCache']) (this as any)['structuralLeafCache'] = new Map<string, THREE.ShaderMaterial>();
        const cache = (this as any)['structuralLeafCache'];

        let cached = cache.get(key);
        if (cached) return cached;

        const cloned = LSystemTreeFactory.leafMaterial.clone() as THREE.ShaderMaterial;
        cloned.uniforms = THREE.UniformsUtils.clone(LSystemTreeFactory.leafMaterial.uniforms);
        cloned.uniforms.uSnowFactor.value = isSnowy ? 1.0 : 0.0;
        cloned.side = side;
        cloned.name = `LSystemTree - Leaf (Shared)${isSnowy ? ' [Snowy]' : ''}${side === THREE.DoubleSide ? ' [DoubleSide]' : ''}`;
        GraphicsUtils.registerObject(cloned);
        cache.set(key, cloned);
        return cloned;
    }

    createInstance(options: LSystemTreeInstanceOptions): DecorationInstance[] {
        const {
            kind,
            variation = Math.random(),
            isSnowy = false,
            leafColor,
            woodColor,
            scale = 1.0,
            isLeafLess = false
        } = options;
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

        const matrix = new THREE.Matrix4();
        if (scale !== 1.0) {
            matrix.makeScale(scale, scale, scale);
        }

        const result: DecorationInstance[] = [
            {
                geometry: best.woodGeo,
                material: this.getWoodMaterial(),
                matrix: matrix.clone(),
                color: new THREE.Color(woodColor ?? best.woodColor ?? 0xffffff)
            }
        ];

        if (!isLeafLess) {
            const side = best.canCullLeaves ? THREE.FrontSide : THREE.DoubleSide;

            result.push({
                geometry: best.leafGeo,
                material: this.getLeafMaterial(isSnowy, side),
                matrix: matrix.clone(),
                color: new THREE.Color(leafColor ?? best.leafColor ?? 0xffffff)
            });
        }

        return result;
    }
}
