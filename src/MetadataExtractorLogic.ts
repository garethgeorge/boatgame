import * as THREE from 'three';
import { DECORATION_MANIFEST } from './world/DecorationsManifest';
import { ENTITY_MANIFEST } from './entities/EntitiesManifest';

export interface DecorationRadii {
    groundRadius: number;
    canopyRadius: number;
}

export interface EntityRadii {
    radius: number;
}

export class MetadataExtractor {

    private static extractRawRadiiSq(object: THREE.Object3D, centerOffset: THREE.Vector3 = new THREE.Vector3()): { canopySq: number, groundSq: number } {
        let maxCanopySq = 0;
        let maxGroundSq = 0;

        const pos = new THREE.Vector3();

        object.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
                child.skeleton.pose();
            }

            if (child instanceof THREE.Mesh && child.visible) {
                const geometry = child.geometry;
                const positionAttr = geometry.getAttribute('position');
                if (positionAttr) {
                    for (let i = 0; i < positionAttr.count; i++) {
                        pos.fromBufferAttribute(positionAttr, i);
                        pos.applyMatrix4(child.matrixWorld);

                        const dx = pos.x - centerOffset.x;
                        const dz = pos.z - centerOffset.z;
                        const distSq = dx * dx + dz * dz;
                        if (distSq > maxCanopySq) maxCanopySq = distSq;

                        if (pos.y < 0.5) {
                            if (distSq > maxGroundSq) maxGroundSq = distSq;
                        }
                    }
                }
            }
        });

        return { canopySq: maxCanopySq, groundSq: maxGroundSq };
    }

    private static extractRadii(object: THREE.Object3D, scale: number = 1.0, useTightBounds: boolean = false): DecorationRadii & { center: THREE.Vector3 } {
        let center = new THREE.Vector3();
        if (useTightBounds) {
            const bbox = new THREE.Box3().setFromObject(object);
            bbox.getCenter(center);
        }

        const { canopySq, groundSq } = this.extractRawRadiiSq(object, center);

        return {
            groundRadius: Math.sqrt(groundSq) * scale,
            canopyRadius: Math.sqrt(canopySq) * scale,
            center: center.multiplyScalar(scale)
        };
    }

    static extractFromInstances(models: any[] | any, hasCanopy: boolean): DecorationRadii {
        const objects = Array.isArray(models) ? models : [models];

        let maxCanopySq = 0;
        let maxGroundSq = 0;

        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            let raw: { canopySq: number, groundSq: number };

            if (obj && obj.geometry && obj.matrix) {
                // DecorationInstance
                const mesh = new THREE.Mesh(obj.geometry);
                mesh.matrix.copy(obj.matrix);
                mesh.updateMatrixWorld(true);
                raw = this.extractRawRadiiSq(mesh);
            } else if (obj instanceof THREE.Object3D) {
                // THREE.Object3D
                obj.updateMatrixWorld(true);
                raw = this.extractRawRadiiSq(obj);
            } else {
                continue;
            }

            maxCanopySq = Math.max(maxCanopySq, raw.canopySq);

            // Ground radius rule:
            // If hasCanopy is true (e.g. Tree), only use the first instance (the trunk).
            // If hasCanopy is false (e.g. Flower), use all instances.
            if (!hasCanopy || i === 0) {
                maxGroundSq = Math.max(maxGroundSq, raw.groundSq);
            }
        }

        const canopyRadius = Math.sqrt(maxCanopySq);
        let groundRadius = Math.sqrt(maxGroundSq);

        // Final fallback: if no ground radius was found, use canopy
        if (groundRadius <= 0) groundRadius = canopyRadius;

        if (!hasCanopy) {
            return { groundRadius: canopyRadius, canopyRadius: 0 };
        } else {
            return {
                groundRadius: groundRadius,
                canopyRadius: canopyRadius
            };
        }
    }

    static async generateMetadata(): Promise<{ decorationResults: Record<string, DecorationRadii>, entityResults: Record<string, EntityRadii> }> {
        console.log("--- Preloading All Assets ---");
        //const { Decorations } = await import('./world/Decorations');
        //await Decorations.preloadAll();

        const decorationResults: Record<string, DecorationRadii> = {};
        const entityResults: Record<string, EntityRadii> = {};
        const round = (val: number) => Math.round(val * 10) / 10;

        console.log("--- Extracting Decoration Metadata ---");
        for (const entry of DECORATION_MANIFEST) {
            try {
                let maxGround = 0;
                let maxCanopy = 0;

                // Sample 30 variants to find the worst-case radii
                for (let i = 0; i < 30; i++) {
                    const model = entry.model();
                    if (!model) continue;

                    // NEW: Ensure world matrices are up to date for vertex extraction
                    if (model instanceof THREE.Object3D) model.updateMatrixWorld(true);

                    const radii = this.extractFromInstances(model as any, entry.hasCanopy);
                    maxGround = Math.max(maxGround, radii.groundRadius);
                    maxCanopy = Math.max(maxCanopy, radii.canopyRadius);
                }

                decorationResults[entry.name] = {
                    groundRadius: round(maxGround),
                    canopyRadius: round(maxCanopy)
                };
                console.log(`Extracted decoration: ${entry.name} -> G:${decorationResults[entry.name].groundRadius}, C:${decorationResults[entry.name].canopyRadius}`);
            } catch (e) {
                console.error(`Failed to extract decoration ${entry.name}:`, e);
            }
        }

        console.log("--- Extracting Entity Metadata ---");
        for (const entry of ENTITY_MANIFEST) {
            try {
                const model = entry.model();
                if (!model) {
                    console.warn(`No model found for entity: ${entry.name}`);
                    continue;
                }

                // NEW: Ensure world matrices are up to date
                model.updateMatrixWorld(true);

                const radii = this.extractRadii(model, entry.scale, true);
                const center = radii.center;
                if (center.length() > 0.1) {
                    console.warn(`Entity ${entry.name} is offset from origin: center=[${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}]`);
                }

                entityResults[entry.name] = { radius: round(radii.canopyRadius) }; // Entities use canopy/max radius
                console.log(`Extracted entity: ${entry.name} -> R:${entityResults[entry.name].radius}`);
            } catch (e) {
                console.error(`Failed to extract entity ${entry.name}:`, e);
            }
        }

        return { decorationResults, entityResults };
    }

    static formatResults(results: { decorationResults: Record<string, DecorationRadii>, entityResults: Record<string, EntityRadii> }): string {
        const formatDecoration = (name: string, data: DecorationRadii) => {
            return `  ${name}: { groundRadius: ${data.groundRadius}, canopyRadius: ${data.canopyRadius} }`;
        };

        const formatEntity = (name: string, data: EntityRadii) => {
            return `  ${name}: { radius: ${data.radius} }`;
        };

        let output = "";
        output += "\n--- PASTE INTO src/world/DecorationMetadata.ts ---\n\n";
        output += "export const DecorationMetadata = {\n";
        output += Object.entries(results.decorationResults)
            .map(([name, data]) => formatDecoration(name, data))
            .join(",\n");
        output += "\n} as const;\n";

        output += "\n--- PASTE INTO src/entities/EntityMetadata.ts ---\n\n";
        output += "export const EntityMetadata = {\n";
        output += Object.entries(results.entityResults)
            .map(([name, data]) => formatEntity(name, data))
            .join(",\n");
        output += "\n} as const;\n";

        return output;
    }
}
