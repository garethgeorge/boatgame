import {
    TransformNode,
    MeshBuilder,
    StandardMaterial,
    Color3,
    Mesh,
    Vector3,
    VertexBuffer
} from '@babylonjs/core';
import { createNoise3D } from 'simplex-noise';
import { DecorationFactory } from './DecorationFactory';

export class RockFactory implements DecorationFactory {
    private static rockMaterialDesert: StandardMaterial;
    private static rockMaterialForest: StandardMaterial;
    private static rockMaterialSwamp: StandardMaterial; // Muddy Brown
    private static iceRockMaterial: StandardMaterial; // Ice Blue

    private static rockNoise3D = createNoise3D();

    private cache: { mesh: TransformNode, size: number, isIcy: boolean }[] = [];

    async load(): Promise<void> {
        // Initialize materials
        import('@babylonjs/core').then(core => {
            if (!RockFactory.rockMaterialDesert) {
                RockFactory.rockMaterialDesert = new core.StandardMaterial("rockDesert");
                RockFactory.rockMaterialDesert.diffuseColor = core.Color3.FromHexString("#E6C288");
                RockFactory.rockMaterialDesert.specularColor = core.Color3.Black();

                RockFactory.rockMaterialForest = new core.StandardMaterial("rockForest");
                RockFactory.rockMaterialForest.diffuseColor = core.Color3.FromHexString("#888888");
                RockFactory.rockMaterialForest.specularColor = core.Color3.Black();

                RockFactory.rockMaterialSwamp = new core.StandardMaterial("rockSwamp");
                RockFactory.rockMaterialSwamp.diffuseColor = core.Color3.FromHexString("#4D3E30");
                RockFactory.rockMaterialSwamp.specularColor = core.Color3.Black();

                RockFactory.iceRockMaterial = new core.StandardMaterial("rockIce");
                RockFactory.iceRockMaterial.diffuseColor = core.Color3.FromHexString("#E0F6FF");
                RockFactory.iceRockMaterial.specularColor = core.Color3.Black();
            }

            console.log("Generating Rock Cache...");
            this.cache = [];
            // Generate Rocks
            for (let i = 0; i < 30; i++) {
                const size = Math.random();
                const mesh = this.createRock(size, false);
                mesh.setEnabled(false);
                this.cache.push({ mesh, size, isIcy: false });
            }
            // Generate Icy Rocks
            for (let i = 0; i < 20; i++) {
                const size = Math.random();
                const mesh = this.createRock(size, true);
                mesh.setEnabled(false);
                this.cache.push({ mesh, size, isIcy: true });
            }
        });
    }

    create(options: { size: number, biome: 'desert' | 'forest' | 'ice' | 'swamp' }): TransformNode {
        // Fallback for sync create before load
        if (!RockFactory.rockMaterialForest) return new TransformNode("rock_placeholder");

        const { size, biome } = options;
        const isIcy = biome === 'ice';

        let mesh: TransformNode;

        if (this.cache.length === 0) {
            mesh = this.spawnRock(size, biome, isIcy);
        } else {
            const candidates = this.cache.filter(r => r.isIcy === isIcy && Math.abs(r.size - size) < 0.3);
            const source = candidates.length > 0
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : this.cache.find(r => r.isIcy === isIcy) || this.cache[0];

            if (source && source.mesh) {
                const rock = source.mesh.instantiateHierarchy() as TransformNode;
                rock.setEnabled(true);
                // Apply material based on biome if not icy
                if (!isIcy) {
                    const material = this.getMaterialForBiome(biome);
                    rock.getChildMeshes().forEach(m => m.material = material);
                }
                mesh = rock;
            } else {
                mesh = this.spawnRock(size, biome, isIcy);
            }
        }

        return mesh;
    }

    private getMaterialForBiome(biome: string): StandardMaterial {
        if (biome === 'desert') return RockFactory.rockMaterialDesert;
        if (biome === 'swamp') return RockFactory.rockMaterialSwamp;
        return RockFactory.rockMaterialForest;
    }

    private spawnRock(size: number, biome: string, isIcy: boolean): TransformNode {
        const rock = this.createRock(size, isIcy);
        if (!isIcy) {
            const material = this.getMaterialForBiome(biome);
            rock.getChildMeshes().forEach(m => m.material = material);
        }
        return rock;
    }

    private createRock(size: number, isIcy: boolean): TransformNode {
        const root = new TransformNode("rock_root");
        root.metadata = { mergeable: true };

        // Size: 0 (Small rock) to 1 (Large boulder)
        // Scale factor: 0.5 to 2.5
        const baseScale = 0.5 + size * 2.0;

        const subdivisions = size > 0.5 ? 1 : 1; // Babylon lowpoly needs >0? 
        // 1 in Babylon is 1 subdivision. 0 is base Icosahedron (12 vertices).

        const mesh = MeshBuilder.CreateIcoSphere("rock", {
            radius: baseScale,
            subdivisions: subdivisions,
            flat: true
        });

        // Vertex Displacement
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        if (positions) {
            const noiseScale = 0.5;
            const noiseStrength = baseScale * 0.4;
            const seedOffset = Math.random() * 100;

            for (let i = 0; i < positions.length; i += 3) {
                const x = positions[i];
                const y = positions[i + 1];
                const z = positions[i + 2];

                const n = RockFactory.rockNoise3D(
                    x * noiseScale + seedOffset,
                    y * noiseScale + seedOffset,
                    z * noiseScale + seedOffset
                );

                const displacement = n * noiseStrength;

                // Direction
                const v = new Vector3(x, y, z).normalize();
                v.scaleInPlace(displacement);

                positions[i] += v.x;
                positions[i + 1] += v.y;
                positions[i + 2] += v.z;
            }
            mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
            // Recompute normals (handled by flat shading usually, but update helps)
            // But if flat, we need to convert to flat shaded mesh logic?
            // Babylon's "flat" option in CreateIcoSphere makes it use independent faces.
            // But getting vertices data might be messy if vertices are duplicated.
            // CreateIcoSphere with flat: true creates separate vertices.
            // That's fine, we iterate all of them.
        }

        // Non-uniform scaling
        mesh.scaling.set(
            1.0 + (Math.random() - 0.5) * 0.4,
            0.6 + (Math.random() - 0.5) * 0.4,
            1.0 + (Math.random() - 0.5) * 0.4
        );

        mesh.material = isIcy ? RockFactory.iceRockMaterial : RockFactory.rockMaterialForest;
        mesh.position.y = baseScale * 0.2;

        // Random rotation
        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        mesh.parent = root;

        // Add a second smaller rock sometimes (Cluster)
        if (size > 0.4 && Math.random() > 0.6) {
            const size2 = size * 0.5;
            const scale2 = baseScale * 0.5;

            const mesh2 = MeshBuilder.CreateIcoSphere("rock2", {
                radius: scale2,
                subdivisions: 0,
                flat: true
            });

            // Vertex Displacement 2
            const positions2 = mesh2.getVerticesData(VertexBuffer.PositionKind);
            if (positions2) {
                const seedOffset2 = Math.random() * 100;
                const noiseScale = 0.5; // Redefine for local scope
                for (let i = 0; i < positions2.length; i += 3) {
                    const x = positions2[i];
                    const y = positions2[i + 1];
                    const z = positions2[i + 2];
                    const n = RockFactory.rockNoise3D(
                        x * noiseScale + seedOffset2,
                        y * noiseScale + seedOffset2,
                        z * noiseScale + seedOffset2
                    );
                    const v = new Vector3(x, y, z).normalize().scale(n * scale2 * 0.4);
                    positions2[i] += v.x;
                    positions2[i + 1] += v.y;
                    positions2[i + 2] += v.z;
                }
                mesh2.updateVerticesData(VertexBuffer.PositionKind, positions2);
            }

            mesh2.scaling.set(1, 0.7, 1);
            mesh2.material = isIcy ? RockFactory.iceRockMaterial : RockFactory.rockMaterialForest;

            const offsetDir = Math.random() * Math.PI * 2;
            const offsetDist = baseScale * 0.9;

            mesh2.position.set(Math.cos(offsetDir) * offsetDist, scale2 * 0.2, Math.sin(offsetDir) * offsetDist);
            mesh2.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            mesh2.parent = root;
        }

        // Optimization: Merge meshes
        const meshes = root.getChildMeshes();
        const merged = Mesh.MergeMeshes(meshes as Mesh[], true, true, undefined, false, true);

        if (merged) {
            merged.name = "rock_merged";
            merged.metadata = { mergeable: true };
            root.dispose();
            return merged;
        }

        return root;
    }
}
