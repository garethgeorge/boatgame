import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { DecorationFactory, DecorationInstance } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface RockArchetype {
    geometry: THREE.BufferGeometry;
    isIcy: boolean;
}

export class RockFactory implements DecorationFactory {
    private static readonly rockMaterialDesert = new THREE.MeshToonMaterial({ color: 0xDDBB88, name: 'Rock - Desert Material' }); // Warm Tan
    private static readonly rockMaterialForest = new THREE.MeshToonMaterial({ color: 0x888888, name: 'Rock - Forest Material' }); // Grey
    private static readonly rockMaterialSwamp = new THREE.MeshToonMaterial({ color: 0x4D3E30, name: 'Rock - Swamp Material' }); // Muddy Brown
    private static readonly iceRockMaterial = new THREE.MeshToonMaterial({ color: 0xE0F6FF, name: 'Rock - Ice Material' }); // Ice Blue

    private static rockNoise3D = createNoise3D();

    static {
        (this.rockMaterialDesert as any).flatShading = true;
        (this.rockMaterialDesert as any).needsUpdate = true;
        (this.rockMaterialForest as any).flatShading = true;
        (this.rockMaterialForest as any).needsUpdate = true;
        (this.rockMaterialSwamp as any).flatShading = true;
        (this.rockMaterialSwamp as any).needsUpdate = true;
        (this.iceRockMaterial as any).flatShading = true;
        (this.iceRockMaterial as any).needsUpdate = true;
    }

    private archetypes: RockArchetype[] = [];

    async load(): Promise<void> {
        // Retain static materials
        GraphicsUtils.registerObject(RockFactory.rockMaterialDesert);
        GraphicsUtils.registerObject(RockFactory.rockMaterialForest);
        GraphicsUtils.registerObject(RockFactory.rockMaterialSwamp);
        GraphicsUtils.registerObject(RockFactory.iceRockMaterial);

        // Clear existing archetypes
        this.archetypes.forEach(a => GraphicsUtils.disposeObject(a.geometry));
        this.archetypes = [];

        console.log("Generating Rock Archetypes...");
        // Generate Standard Rocks
        for (let i = 0; i < 20; i++) {
            this.archetypes.push(this.generateArchetype(false));
        }
        // Generate Icy Rocks
        for (let i = 0; i < 20; i++) {
            this.archetypes.push(this.generateArchetype(true));
        }
    }

    createInstance(options: { size: number, biome: string }): DecorationInstance[] {
        const { size, biome } = options;
        const isIcy = biome === 'ice';

        const candidates = this.archetypes.filter(a => a.isIcy === isIcy);
        if (candidates.length === 0) return [];

        const archetype = candidates[Math.floor(Math.random() * candidates.length)];

        // Final scale = variety scale * size parameter
        const scale = 0.8 + size * 0.4; // Small jitter around target size
        const matrix = new THREE.Matrix4().makeScale(scale, scale, scale);

        return [{
            geometry: archetype.geometry,
            material: this.getMaterialForBiome(biome),
            matrix: matrix,
            color: new THREE.Color(1, 1, 1)
        }];
    }

    create(options: { size: number, biome: string }): THREE.Group {
        const instances = this.createInstance(options);
        const group = new THREE.Group();
        for (const inst of instances) {
            const mesh = GraphicsUtils.createMesh(inst.geometry, inst.material);
            mesh.applyMatrix4(inst.matrix);
            group.add(mesh);
        }
        return group;
    }

    private getMaterialForBiome(biome: string): THREE.Material {
        if (biome === 'ice') return RockFactory.iceRockMaterial;
        if (biome === 'desert') return RockFactory.rockMaterialDesert;
        if (biome === 'swamp') return RockFactory.rockMaterialSwamp;
        return RockFactory.rockMaterialForest; // Default for forest, jurassic
    }

    private generateArchetype(isIcy: boolean): RockArchetype {
        const geometries: THREE.BufferGeometry[] = [];

        // Random base scale for variety within the archetypes
        const baseScale = 1.0 + Math.random() * 1.5;

        // Main rock
        geometries.push(this.createRockGeometry(baseScale));

        // Add a second smaller rock sometimes (Cluster)
        if (Math.random() > 0.6) {
            const scale2 = baseScale * (0.4 + Math.random() * 0.3);
            const geo2 = this.createRockGeometry(scale2);

            const offsetDir = Math.random() * Math.PI * 2;
            const offsetDist = baseScale * 0.9;
            const matrix = new THREE.Matrix4().makeTranslation(
                Math.cos(offsetDir) * offsetDist,
                0,
                Math.sin(offsetDir) * offsetDist
            );
            geo2.applyMatrix4(matrix);
            geometries.push(geo2);
        }

        const mergedGeo = geometries.length > 1
            ? BufferGeometryUtils.mergeGeometries(geometries)
            : geometries[0];

        mergedGeo.name = isIcy ? 'Rock - Icy Merged Geometry' : 'Rock - Standard Merged Geometry';
        GraphicsUtils.registerObject(mergedGeo);

        // Dispose intermediate geometries
        if (geometries.length > 1) {
            geometries.forEach(g => GraphicsUtils.disposeObject(g));
        }

        return { geometry: mergedGeo, isIcy };
    }

    private createRockGeometry(scale: number): THREE.BufferGeometry {
        const detail = scale > 1.5 ? 1 : 0;
        const geo = new THREE.IcosahedronGeometry(scale, detail);

        const posAttribute = geo.attributes.position;
        const vertex = new THREE.Vector3();

        const noiseScale = 0.5;
        const noiseStrength = scale * 0.4;
        const seedOffset = Math.random() * 100;

        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);
            const n = RockFactory.rockNoise3D(
                vertex.x * noiseScale + seedOffset,
                vertex.y * noiseScale + seedOffset,
                vertex.z * noiseScale + seedOffset
            );
            const displacement = n * noiseStrength;
            const dir = vertex.clone().normalize();
            vertex.add(dir.multiplyScalar(displacement));
            posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        geo.computeVertexNormals();

        // Non-uniform scaling
        const sX = 1.0 + (Math.random() - 0.5) * 0.4;
        const sY = 0.6 + (Math.random() - 0.5) * 0.4;
        const sZ = 1.0 + (Math.random() - 0.5) * 0.4;
        geo.scale(sX, sY, sZ);

        // Random rotation
        const rotX = Math.random() * Math.PI;
        const rotY = Math.random() * Math.PI;
        const rotZ = Math.random() * Math.PI;

        const matrix = new THREE.Matrix4()
            .makeRotationFromEuler(new THREE.Euler(rotX, rotY, rotZ))
            .setPosition(0, scale * 0.2, 0);

        geo.applyMatrix4(matrix);

        return geo;
    }
}
