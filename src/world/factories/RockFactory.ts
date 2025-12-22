import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class RockFactory implements DecorationFactory {
    private static readonly rockMaterialDesert = new THREE.MeshToonMaterial({ color: 0xE6C288, name: 'Rock - Desert Material' }); // Yellow Sandstone
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

    private cache: { mesh: THREE.Group, size: number, isIcy: boolean }[] = [];

    async load(): Promise<void> {
        // Retain static materials
        GraphicsUtils.registerObject(RockFactory.rockMaterialDesert);
        GraphicsUtils.registerObject(RockFactory.rockMaterialForest);
        GraphicsUtils.registerObject(RockFactory.rockMaterialSwamp);
        GraphicsUtils.registerObject(RockFactory.iceRockMaterial);

        // Clear existing cache and release old meshes
        this.cache.forEach(r => GraphicsUtils.disposeObject(r.mesh));
        this.cache = [];

        console.log("Generating Rock Cache...");
        // Generate Rocks
        for (let i = 0; i < 30; i++) {
            const size = Math.random();
            const mesh = this.createRock(size, false);
            this.cache.push({ mesh, size, isIcy: false });
        }
        // Generate Icy Rocks
        for (let i = 0; i < 20; i++) {
            const size = Math.random();
            const mesh = this.createRock(size, true);
            this.cache.push({ mesh, size, isIcy: true });
        }
    }

    create(options: { size: number, biome: string }): THREE.Group {
        const { size, biome } = options;
        const isIcy = biome === 'ice';

        let mesh: THREE.Group;

        if (this.cache.length === 0) {
            mesh = this.spawnRock(size, biome, isIcy);
        } else {
            const candidates = this.cache.filter(r => r.isIcy === isIcy && Math.abs(r.size - size) < 0.3);
            const source = candidates.length > 0
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : this.cache.find(r => r.isIcy === isIcy) || this.cache[0];

            const rock = source ? GraphicsUtils.cloneObject(source.mesh) : this.createRock(size, isIcy);

            // Apply material based on biome if not icy
            if (!isIcy) {
                const material = this.getMaterialForBiome(biome);
                rock.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        GraphicsUtils.assignMaterial(child, material);
                    }
                });
            }
            mesh = rock;
        }

        return mesh;
    }

    private getMaterialForBiome(biome: string): THREE.Material {
        if (biome === 'desert') return RockFactory.rockMaterialDesert;
        if (biome === 'swamp') return RockFactory.rockMaterialSwamp;
        return RockFactory.rockMaterialForest; // Default for forest, jurassic
    }

    private spawnRock(size: number, biome: string, isIcy: boolean): THREE.Group {
        const rock = this.createRock(size, isIcy);
        if (!isIcy) {
            const material = this.getMaterialForBiome(biome);
            rock.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    GraphicsUtils.assignMaterial(child, material);
                }
            });
        }
        return rock;
    }

    private createRock(size: number, isIcy: boolean): THREE.Group {
        const group = new THREE.Group();

        // Size: 0 (Small rock) to 1 (Large boulder)
        // Scale factor: 0.5 to 2.5
        const baseScale = 0.5 + size * 2.0;

        const detail = size > 0.5 ? 1 : 0;
        const geo = new THREE.IcosahedronGeometry(baseScale, detail);
        geo.name = 'Rock - Geometry';

        const posAttribute = geo.attributes.position;
        const vertex = new THREE.Vector3();

        // Noise parameters
        const noiseScale = 0.5; // How frequent the noise is
        const noiseStrength = baseScale * 0.4; // How much to displace

        // Seed offset for variety
        const seedOffset = Math.random() * 100;

        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);

            // 3D Noise
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

        // Non-uniform scaling for variety (flattened, stretched)
        geo.scale(
            1.0 + (Math.random() - 0.5) * 0.4,
            0.6 + (Math.random() - 0.5) * 0.4, // Generally flatter
            1.0 + (Math.random() - 0.5) * 0.4
        );

        // Default material (will be swapped)
        const mesh = GraphicsUtils.createMesh(geo, isIcy ? RockFactory.iceRockMaterial : RockFactory.rockMaterialForest);

        // Random rotation
        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        mesh.position.y = baseScale * 0.2;

        group.add(mesh);

        // Add a second smaller rock sometimes (Cluster)
        if (size > 0.4 && Math.random() > 0.6) {
            const size2 = size * 0.5;
            const scale2 = baseScale * 0.5;
            const geo2 = new THREE.IcosahedronGeometry(scale2, 0);
            geo2.name = 'Rock - Cluster Geometry';

            const posAttribute2 = geo2.attributes.position;
            const vertex2 = new THREE.Vector3();
            const seedOffset2 = Math.random() * 100;

            for (let i = 0; i < posAttribute2.count; i++) {
                vertex2.fromBufferAttribute(posAttribute2, i);
                const n = RockFactory.rockNoise3D(
                    vertex2.x * noiseScale + seedOffset2,
                    vertex2.y * noiseScale + seedOffset2,
                    vertex2.z * noiseScale + seedOffset2
                );
                const dir = vertex2.clone().normalize();
                vertex2.add(dir.multiplyScalar(n * scale2 * 0.4));
                posAttribute2.setXYZ(i, vertex2.x, vertex2.y, vertex2.z);
            }
            geo2.computeVertexNormals();
            geo2.scale(1, 0.7, 1);

            const mesh2 = GraphicsUtils.createMesh(geo2, isIcy ? RockFactory.iceRockMaterial : RockFactory.rockMaterialForest);

            const offsetDir = Math.random() * Math.PI * 2;
            const offsetDist = baseScale * 0.9;

            mesh2.position.set(Math.cos(offsetDir) * offsetDist, scale2 * 0.2, Math.sin(offsetDir) * offsetDist);
            mesh2.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            group.add(mesh2);
        }

        return group;
    }
}
