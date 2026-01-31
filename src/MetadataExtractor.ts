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

    private static extractRadii(object: THREE.Object3D, scale: number = 1.0): DecorationRadii {
        let maxCanopySq = 0;
        let maxGroundSq = 0;

        const pos = new THREE.Vector3();

        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const geometry = child.geometry;

                // 1. & 2. Radii (Vertex Sampling - XZ plane only)
                // We iterate all vertices to find the max distance from origin in XZ.
                // We also track max distance specifically for vertices "near the ground".
                const positionAttr = geometry.getAttribute('position');
                if (positionAttr) {
                    for (let i = 0; i < positionAttr.count; i++) {
                        pos.fromBufferAttribute(positionAttr, i);
                        pos.applyMatrix4(child.matrixWorld);

                        // We only care about XZ distance for "radius" in this game's physics
                        const distSq = pos.x * pos.x + pos.z * pos.z;

                        // Canopy is max distance of ANY vertex
                        if (distSq > maxCanopySq) maxCanopySq = distSq;

                        // Ground is max distance of vertices near the ground (low Y)
                        if (pos.y < 0.5) {
                            if (distSq > maxGroundSq) maxGroundSq = distSq;
                        }
                    }
                }
            }
        });

        const canopyRadius = Math.sqrt(maxCanopySq) * scale;
        const groundRadius = Math.sqrt(maxGroundSq) * scale;

        return {
            groundRadius: groundRadius,
            canopyRadius: canopyRadius
        };
    }

    static extractFromInstances(models: any[] | any, hasCanopy: boolean): DecorationRadii {
        const objects = Array.isArray(models) ? models : [models];
        let maxGround = 0;
        let maxCanopy = 0;

        for (const obj of objects) {
            let radii: DecorationRadii;
            if (obj.geometry && obj.matrix) {
                // DecorationInstance
                const matrix = obj.matrix as THREE.Matrix4;
                const geometry = obj.geometry as THREE.BufferGeometry;

                const tempMesh = new THREE.Mesh(geometry);
                tempMesh.matrixWorld.copy(matrix);
                radii = this.extractRadii(tempMesh);
            } else if (obj instanceof THREE.Object3D) {
                // THREE.Object3D (can be a Group/Mesh)
                radii = this.extractRadii(obj);
            } else {
                continue;
            }

            maxGround = Math.max(maxGround, radii.groundRadius);
            maxCanopy = Math.max(maxCanopy, radii.canopyRadius);
        }

        // Final fallback: if no ground radius was found, use canopy
        if (maxGround <= 0) maxGround = maxCanopy;

        if (!hasCanopy) {
            return { groundRadius: maxCanopy, canopyRadius: 0 };
        } else {
            return {
                groundRadius: maxGround,
                canopyRadius: maxCanopy
            };
        }
    }

    static async generateMetadata(): Promise<string> {
        console.log("--- Preloading All Assets ---");
        const { Decorations } = await import('./world/Decorations');
        await Decorations.preloadAll();

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
                const radii = this.extractRadii(model, entry.scale);
                entityResults[entry.name] = { radius: round(radii.canopyRadius) }; // Entities use canopy/max radius
                console.log(`Extracted entity: ${entry.name} -> R:${entityResults[entry.name].radius}`);
            } catch (e) {
                console.error(`Failed to extract entity ${entry.name}:`, e);
            }
        }

        const formatDecoration = (name: string, data: DecorationRadii) => {
            return `  ${name}: { groundRadius: ${data.groundRadius}, canopyRadius: ${data.canopyRadius} }`;
        };

        const formatEntity = (name: string, data: EntityRadii) => {
            return `  ${name}: { radius: ${data.radius} }`;
        };

        let output = "";
        output += "\n--- PASTE INTO src/world/DecorationMetadata.ts ---\n\n";
        output += "export const DecorationMetadata = {\n";
        output += Object.entries(decorationResults)
            .map(([name, data]) => formatDecoration(name, data))
            .join(",\n");
        output += "\n} as const;\n";

        output += "\n--- PASTE INTO src/entities/EntityMetadata.ts ---\n\n";
        output += "export const EntityMetadata = {\n";
        output += Object.entries(entityResults)
            .map(([name, data]) => formatEntity(name, data))
            .join(",\n");
        output += "\n} as const;\n";

        console.log(output);
        return output;
    }
}

