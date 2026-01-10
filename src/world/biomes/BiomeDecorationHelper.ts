import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { DecorationInstance } from '../factories/DecorationFactory';
import { TerrainChunk } from '../TerrainChunk';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class BiomeDecorationHelper {
    public generateRandomPositionInRange(context: DecorationContext, zStart: number, zEnd: number): { worldX: number; worldZ: number; height: number } {
        const dz = Math.random() * (zEnd - zStart);
        const wz = zStart + dz;
        const u = Math.random() * 2 - 1;
        const dx = u * (TerrainChunk.CHUNK_WIDTH / 2);
        const riverCenter = context.riverSystem.getRiverCenter(wz);
        const wx = dx + riverCenter;
        const height = context.riverSystem.terrainGeometry.calculateHeight(wx, wz);

        return { worldX: wx, worldZ: wz, height };
    }

    public isValidDecorationPosition(
        context: DecorationContext,
        position: { worldX: number; worldZ: number; height: number }
    ): boolean {
        const riverWidth = context.riverSystem.getRiverWidth(position.worldZ);
        const riverCenter = context.riverSystem.getRiverCenter(position.worldZ);
        const distFromCenter = Math.abs(position.worldX - riverCenter);
        const distFromBank = distFromCenter - riverWidth / 2;

        // Apply distance-based probability bias
        if (distFromBank > 0) {
            const biasDistance = 80;
            const normalizedDist = Math.min(1.0, distFromBank / biasDistance);
            const probability = Math.pow(1.0 - normalizedDist, 2);
            if (Math.random() > probability) return false;
        }

        // Check minimum height
        if (position.height < 2.0) return false;

        // Check visibility
        if (!context.riverSystem.terrainGeometry.checkVisibility(position.worldX, position.height, position.worldZ)) {
            return false;
        }

        return true;
    }

    /**
     * Assumes it is passed an object that should be disposed. Collects
     * copies of the geometry from the object.
     */
    public positionAndCollectGeometry(
        object: THREE.Object3D,
        position: { worldX: number; height: number; worldZ: number },
        context: DecorationContext
    ): void {
        object.position.set(position.worldX, position.height, position.worldZ);
        object.rotation.y = Math.random() * Math.PI * 2;
        object.updateMatrixWorld(true);

        // Collect geometries for merging. The cloned geometries
        // are disposed when merged.
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // clone geometry with matrix applied
                const geometry = child.geometry.clone();
                GraphicsUtils.registerObject(geometry);
                geometry.name = 'Decorations - cloned geom';
                geometry.applyMatrix4(child.matrixWorld);

                const material = child.material as THREE.Material;
                if (!context.geometriesByMaterial.has(material)) {
                    context.geometriesByMaterial.set(material, []);
                }
                context.geometriesByMaterial.get(material)!.push(geometry);
            }
        });

        GraphicsUtils.disposeObject(object);
    }

    /**
     * Registers an instance for instanced rendering.
     */
    public addInstance(
        context: DecorationContext,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        matrix: THREE.Matrix4,
        color?: THREE.Color
    ): void {
        if (!context.instancedData.has(geometry)) {
            context.instancedData.set(geometry, new Map());
        }
        const materialsMap = context.instancedData.get(geometry)!;
        if (!materialsMap.has(material)) {
            materialsMap.set(material, []);
        }
        materialsMap.get(material)!.push({ matrix: matrix.clone(), color: color?.clone() });
    }

    public mergeAndAddGeometries(
        context: DecorationContext
    ): void {
        const geometriesByMaterial = context.geometriesByMaterial;
        const group = context.geometryGroup;
        // Merge standard geometries
        for (const [material, geometries] of geometriesByMaterial) {
            if (geometries.length === 0) continue;

            const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
            mergedGeometry.name = 'Decorations - merged geom';

            const mesh = GraphicsUtils.createMesh(mergedGeometry, material, 'BiomeMergedDecoration');
            // Material is shared from decorators, so we DON'T dispose it here

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            // Dispose of the source geometries (clones) now that they are merged
            for (const geometry of geometries) {
                GraphicsUtils.disposeObject(geometry);
            }
        }

        // Add instanced meshes
        if (context && context.instancedData) {
            for (const [geometry, materialsMap] of context.instancedData) {
                for (const [material, data] of materialsMap) {
                    if (data.length === 0) continue;

                    const iMesh = GraphicsUtils.createInstancedMesh(
                        geometry,
                        material,
                        data.length,
                        'BiomeInstancedDecoration'
                    );

                    for (let i = 0; i < data.length; i++) {
                        iMesh.setMatrixAt(i, data[i].matrix);
                        if (data[i].color) {
                            iMesh.setColorAt(i, data[i].color!);
                        }
                    }

                    // iMesh instances don't individualy cast/receive shadows in simple setups
                    // but the mesh as a whole can.
                    iMesh.castShadow = true;
                    iMesh.receiveShadow = true;
                    group.add(iMesh);
                }
            }
        }
    }
    public addInstancedDecoration(
        context: DecorationContext,
        instances: DecorationInstance[],
        position: { worldX: number; height: number; worldZ: number },
        rotationY: number = Math.random() * Math.PI * 2,
        scale: number = 1.0 + (Math.random() - 0.5) * 0.2
    ): void {
        const worldMatrix = new THREE.Matrix4().compose(
            new THREE.Vector3(position.worldX, position.height, position.worldZ),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0)),
            new THREE.Vector3(scale, scale, scale)
        );

        for (const instance of instances) {
            const finalMatrix = instance.matrix.clone().premultiply(worldMatrix);
            this.addInstance(context, instance.geometry, instance.material, finalMatrix, instance.color);
        }
    }
}
