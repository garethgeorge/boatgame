import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { DecorationFactory } from './DecorationFactory';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class RiverRockFactory implements DecorationFactory {
    private static noise3D = createNoise3D();

    async load(): Promise<void> {
        // No pre-loaded assets for now, but we could cache some base geometries if needed.
    }

    private static sharedMaterial: THREE.MeshToonMaterial | null = null;

    private getSharedMaterial(): THREE.MeshToonMaterial {
        if (!RiverRockFactory.sharedMaterial) {
            const material = new THREE.MeshToonMaterial({
                vertexColors: true,
                color: 0xffffff,
                transparent: true
            });
            (material as any).flatShading = true;
            material.name = 'RiverRockMaterial';

            material.onBeforeCompile = (shader) => {
                shader.vertexShader = `
                    varying float vWorldY;
                    ${shader.vertexShader}
                `.replace(
                    '#include <worldpos_vertex>',
                    `
                    #include <worldpos_vertex>
                    vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
                    `
                );

                shader.fragmentShader = `
                    varying float vWorldY;
                    ${shader.fragmentShader}
                `.replace(
                    '#include <opaque_fragment>',
                    `
                    #include <opaque_fragment>
                    // Fade out below water (Y=0) over 1 meters
                    gl_FragColor.a *= smoothstep(-2.0, 0.0, vWorldY);
                    `
                );
            };

            GraphicsUtils.registerObject(material);
            RiverRockFactory.sharedMaterial = material;
        }
        return RiverRockFactory.sharedMaterial;
    }

    create(options: { radius: number, hasPillars: boolean, biome: string }): THREE.Group {
        const { radius, hasPillars, biome } = options;
        const group = new THREE.Group();
        group.name = 'RiverRockGroup';

        const numRocks = 2 + Math.floor(Math.random() * 3); // 2 to 4 rocks
        const palette = this.getPalette(biome);
        const material = this.getSharedMaterial();

        for (let i = 0; i < numRocks; i++) {
            // Only generate pillar if allowed and for the first rock (sometimes)
            const isPillar = hasPillars && i === 0 && Math.random() > 0.4;

            const rockRadius = radius * (0.6 + Math.random() * 0.6);

            // Height logic: Ensure we have enough above water and at least 2.5m below water
            const heightAbove = isPillar ? rockRadius * (2.5 + Math.random() * 2) : rockRadius * (0.8 + Math.random() * 0.5);
            const depthBelow = 2.5;
            const totalHeight = heightAbove + depthBelow;

            // boulders use straight cylinders initially; we shape them in displacement
            const geometry = isPillar
                ? new THREE.CylinderGeometry(rockRadius * 0.4, rockRadius * 0.8, totalHeight, 8, 8)
                : new THREE.CylinderGeometry(rockRadius, rockRadius, totalHeight, 8, 8);

            geometry.name = `RiverRockPart_${i}`;

            this.displaceAndColorGeometry(geometry, rockRadius, heightAbove, depthBelow, isPillar, palette);

            const mesh = GraphicsUtils.createMesh(geometry, material, `RiverRockMesh_${i}`);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const angle = (i / numRocks) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = (i === 0 && isPillar) ? 0 : radius * 0.5 * Math.random();

            // Positioning: y=0 is water level. The cylinder center is at 0.
            // We want the top at heightAbove and bottom at -depthBelow.
            const yPos = (heightAbove - depthBelow) / 2;

            mesh.position.set(
                Math.cos(angle) * dist,
                yPos,
                Math.sin(angle) * dist
            );

            // Add some jitter to position
            mesh.position.y -= Math.random() * 0.2;

            mesh.rotation.set(
                (Math.random() - 0.5) * 0.1,
                Math.random() * Math.PI * 2,
                (Math.random() - 0.5) * 0.1
            );

            group.add(mesh);
        }

        return group;
    }

    private getPalette(biome: string) {
        if (biome === 'desert') {
            const palettes = [
                { base: new THREE.Color(0x5D4037), mid: new THREE.Color(0xCC8822), peak: new THREE.Color(0xDDBB88) },
                { base: new THREE.Color(0x4A3728), mid: new THREE.Color(0xB58E62), peak: new THREE.Color(0xDDBB88) },
                { base: new THREE.Color(0x8B5A2B), mid: new THREE.Color(0xCC8822), peak: new THREE.Color(0xDDBB88) },
            ];
            return palettes[Math.floor(Math.random() * palettes.length)];
        } else {
            // Blue Gray Palette
            const palettes = [
                { base: new THREE.Color(0x2c3e50), mid: new THREE.Color(0x5d6d7e), peak: new THREE.Color(0xaeb6bf) },
                { base: new THREE.Color(0x34495e), mid: new THREE.Color(0x85929e), peak: new THREE.Color(0xd5dbda) },
            ];
            return palettes[Math.floor(Math.random() * palettes.length)];
        }
    }

    private displaceAndColorGeometry(
        geometry: THREE.BufferGeometry,
        radius: number,
        heightAbove: number,
        depthBelow: number,
        isPillar: boolean,
        palette: { base: THREE.Color, mid: THREE.Color, peak: THREE.Color }
    ) {
        const height = heightAbove + depthBelow;
        const yPosOffset = (heightAbove - depthBelow) / 2;
        const posAttr = geometry.attributes.position;
        const colorAttr = new THREE.Float32BufferAttribute(posAttr.count * 3, 3);
        const vertex = new THREE.Vector3();
        const color = new THREE.Color();

        const seed = Math.random() * 1000;

        for (let i = 0; i < posAttr.count; i++) {
            vertex.fromBufferAttribute(posAttr, i);

            const worldY = vertex.y + yPosOffset;
            const horizontalDir = new THREE.Vector3(vertex.x, 0, vertex.z).normalize();

            if (!isPillar) {
                // Shape boulders above water into a dome
                if (worldY > 0) {
                    const hFactor = Math.min(1.0, worldY / heightAbove);
                    // Spherical taper: r = r0 * sqrt(1 - h^2)
                    const taper = Math.sqrt(1.0 - hFactor * hFactor);
                    vertex.x = horizontalDir.x * radius * taper;
                    vertex.z = horizontalDir.z * radius * taper;
                } else {
                    // Below water, keep standard cylinder radius to ensure it's not narrower
                    vertex.x = horizontalDir.x * radius;
                    vertex.z = horizontalDir.z * radius;
                }
            }

            // Use radial displacement for both but stronger noise for boulders
            const noiseScale = isPillar ? 0.8 : 0.6;
            const noiseStrength = radius * (isPillar ? 0.15 : 0.3);

            let n = RiverRockFactory.noise3D(
                vertex.x * noiseScale + seed,
                vertex.y * (isPillar ? 0.2 : 0.4) + seed,
                vertex.z * noiseScale + seed
            );

            if (isPillar) {
                const angle = Math.atan2(vertex.x, vertex.z);
                n += Math.sin(angle * 8) * 0.2;
            }

            const displacement = n * noiseStrength;

            // Apply displacement
            vertex.add(horizontalDir.multiplyScalar(displacement));

            // Add some vertical jitter for boulders
            if (!isPillar) {
                vertex.y += RiverRockFactory.noise3D(vertex.x + 50, vertex.y, vertex.z) * radius * 0.1;
            }

            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);

            // Vertical gradient coloring based on local Y
            const hFract = (vertex.y + height / 2) / height;
            if (hFract < 0.5) {
                color.copy(palette.base).lerp(palette.mid, hFract * 2);
            } else {
                color.copy(palette.mid).lerp(palette.peak, (hFract - 0.5) * 2);
            }

            const cNoise = RiverRockFactory.noise3D(vertex.x * 2, vertex.y * 2, vertex.z * 2) * 0.05;
            color.r += cNoise;
            color.g += cNoise;
            color.b += cNoise;

            colorAttr.setXYZ(i, color.r, color.g, color.b);
        }

        geometry.setAttribute('color', colorAttr);
        geometry.computeVertexNormals();
    }
}
