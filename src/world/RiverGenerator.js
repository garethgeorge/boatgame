import * as THREE from 'three';
import { RiverPath } from './RiverPath.js';
import { Decoration } from '../entities/Decoration.js';
import { Crow } from '../entities/Crow.js';

const BIOMES = {
    DESERT: {
        name: 'desert',
        decorations: [
            { type: 'cactus', weight: 0.4 },
            { type: 'rock', weight: 0.4 },
            { type: 'crow', weight: 0.2 }
        ]
    },
    FOREST: {
        name: 'forest',
        decorations: [
            { type: 'tree', weight: 0.5 },
            { type: 'bush', weight: 0.3 },
            { type: 'dead_tree', weight: 0.2 }
        ]
    }
};

export class RiverGenerator {
    constructor(scene) {
        this.scene = scene;
        this.riverPath = new RiverPath();
        this.chunks = [];
        this.chunkSize = 50;
        this.riverWidth = 40;
        
        for (let z = 50; z > -200; z -= this.chunkSize) {
            this.generateChunk(z);
        }
    }

    update(playerPosition) {
        // Generate new chunks ahead (negative Z)
        const lastChunk = this.chunks[this.chunks.length - 1];
        if (lastChunk.zEnd > playerPosition.z - 200) {
            this.generateChunk(lastChunk.zEnd);
        }

        // Remove old chunks (positive Z)
        if (this.chunks[0].zStart > playerPosition.z + 100) {
            this.removeChunk(this.chunks[0]);
            this.chunks.shift();
        }

        // Update decorations (e.g. Crows)
        this.chunks.forEach(chunk => {
            if (chunk.decorations) {
                chunk.decorations.forEach(decoration => {
                    if (decoration.update) {
                        // Pass a dummy dt as it's not crucial for simple Crow animation
                        decoration.update(0.016, playerPosition);
                    }
                });
            }
        });
    }

    generateChunk(zStart) {
        const zEnd = zStart - this.chunkSize;
        const segments = 20;

        const bankMesh = this.createChunkMesh(zStart, zEnd, segments);
        const waterMesh = this.createWaterMesh(zStart, zEnd, segments);
        
        // Attach water to bank mesh for easier management as one mesh
        bankMesh.add(waterMesh);
        this.scene.add(bankMesh);

        const decorations = this.addDecorations(zStart, zEnd);

        this.chunks.push({
            mesh: bankMesh, // Store combined mesh
            decorations: decorations,
            zStart: zStart,
            zEnd: zEnd
        });
    }

    createChunkMesh(zStart, zEnd, segments) {
        const vertices = [];
        const indices = [];
        const colors = [];
        
        const colorHighHumidity = new THREE.Color(0x228B22); // Forest Green
        const colorLowHumidity = new THREE.Color(0xDAA520);  // Goldenrod
        const bankColor = new THREE.Color();

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const z = zStart + t * (zEnd - zStart);
            const humidity = this.riverPath.getHumidityAt(z);
            bankColor.lerpColors(colorLowHumidity, colorHighHumidity, humidity);
            
            const point = this.riverPath.getPointAt(z);
            const tangent = this.riverPath.getTangentAt(z);
            const width = this.riverPath.getWidthAt(z);
            
            const up = new THREE.Vector3(0, 1, 0);
            const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
            
            const bankHeight = 4;
            const bankSlopeWidth = 8;
            const bankFlatWidth = 50;

            const leftWaterEdge = point.clone().add(normal.clone().multiplyScalar(-width/2));
            const rightWaterEdge = point.clone().add(normal.clone().multiplyScalar(width/2));
            
            const leftBankTop = leftWaterEdge.clone().add(normal.clone().multiplyScalar(-bankSlopeWidth));
            leftBankTop.y += bankHeight;
            
            const rightBankTop = rightWaterEdge.clone().add(normal.clone().multiplyScalar(bankSlopeWidth));
            rightBankTop.y += bankHeight;
            
            const leftFlatEnd = leftBankTop.clone().add(normal.clone().multiplyScalar(-bankFlatWidth));
            const rightFlatEnd = rightBankTop.clone().add(normal.clone().multiplyScalar(bankFlatWidth));
            
            [leftFlatEnd, leftBankTop, leftWaterEdge, rightWaterEdge, rightBankTop, rightFlatEnd].forEach(v => {
                vertices.push(v.x, v.y, v.z);
                colors.push(bankColor.r, bankColor.g, bankColor.b);
            });
        }
        
        for (let i = 0; i < segments; i++) {
            const base = i * 6;
            indices.push(base + 0, base + 1, base + 7);
            indices.push(base + 0, base + 7, base + 6);
            indices.push(base + 1, base + 2, base + 8);
            indices.push(base + 1, base + 8, base + 7);
            indices.push(base + 3, base + 4, base + 10);
            indices.push(base + 3, base + 10, base + 9);
            indices.push(base + 4, base + 5, base + 11);
            indices.push(base + 4, base + 11, base + 10);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        
        const bankMesh = new THREE.Mesh(geometry, material);
        bankMesh.receiveShadow = true;
        return bankMesh;
    }

    createWaterMesh(zStart, zEnd, segments) {
        const vertices = [];
        const indices = [];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const z = zStart + t * (zEnd - zStart);
            
            const point = this.riverPath.getPointAt(z);
            const tangent = this.riverPath.getTangentAt(z);
            const width = this.riverPath.getWidthAt(z);
            
            const up = new THREE.Vector3(0, 1, 0);
            const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
            
            const left = point.clone().add(normal.clone().multiplyScalar(-width/2));
            const right = point.clone().add(normal.clone().multiplyScalar(width/2));
            
            left.y = -0.2;
            right.y = -0.2;
            
            vertices.push(left.x, left.y, left.z);
            vertices.push(right.x, right.y, right.z);
        }
        
        for (let i = 0; i < segments; i++) {
            const base = i * 2;
            indices.push(base, base + 1, base + 3);
            indices.push(base, base + 3, base + 2);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x0099ff,
            roughness: 0.1,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        return new THREE.Mesh(geometry, material);
    }

    addDecorations(zStart, zEnd) {
        const decorations = [];
        const count = 5;
        
        for (let i = 0; i < count; i++) {
            const t = Math.random();
            const z = zStart + t * (zEnd - zStart);
            
            const point = this.riverPath.getPointAt(z);
            const tangent = this.riverPath.getTangentAt(z);
            const width = this.riverPath.getWidthAt(z);
            const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
            
            const side = Math.random() > 0.5 ? 1 : -1;
            const bankSlopeWidth = 8;
            const minDist = (width / 2) + bankSlopeWidth + 2;
            const maxDist = minDist + 20;
            const distance = minDist + Math.random() * (maxDist - minDist);
            
            const position = point.clone().add(normal.multiplyScalar(side * distance));
            position.y = 4; // Bank height
            
            const humidity = this.riverPath.getHumidityAt(z);
            
            // Determine Biome
            let biome = BIOMES.DESERT;
            if (humidity > 0.5) {
                biome = BIOMES.FOREST;
            }

            // Select Decoration
            const rand = Math.random();
            let cumulativeWeight = 0;
            let type = 'rock'; // Default
            
            for (const deco of biome.decorations) {
                cumulativeWeight += deco.weight;
                if (rand < cumulativeWeight) {
                    type = deco.type;
                    break;
                }
            }
            
            let decoration;
            if (type === 'crow') {
                decoration = new Crow({
                    scene: this.scene,
                    position: position
                });
            } else {
                decoration = new Decoration({
                    scene: this.scene,
                    position: position,
                    type: type
                });
            }
            
            decorations.push(decoration);
        }
        return decorations;
    }
    
    removeChunk(chunk) {
        this.scene.remove(chunk.mesh);
        // Safely dispose of chunk mesh geometry and material
        if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
        if (chunk.mesh.material) chunk.mesh.material.dispose();
        
        if (chunk.decorations) {
            chunk.decorations.forEach(decoration => {
                // Check if it has a destroy method (Entity should have it, but let's be safe)
                if (decoration.destroy) decoration.destroy();
            });
        }
    }

    getRiverTangent(z) {
        return this.riverPath.getTangentAt(z);
    }
    
    getRiverCenter(z) {
        return this.riverPath.getPointAt(z);
    }
}
