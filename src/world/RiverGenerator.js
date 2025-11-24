import * as THREE from 'three';
import { RiverPath } from './RiverPath.js';
import { Decoration } from '../entities/Decoration.js';

export class RiverGenerator {
    constructor(scene) {
        this.scene = scene;
        this.riverPath = new RiverPath();
        this.chunks = [];
        this.chunkSize = 50; // Smaller chunks for smoother updates
        this.riverWidth = 40;
        
        // Initial chunks
        // Player starts at Z=0, moving to -Z
        // Generate from +50 to -200
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
    }

    generateChunk(zStart) {
        const zEnd = zStart - this.chunkSize;
        const mesh = this.createChunkMesh(zStart, zEnd);
        this.scene.add(mesh);

        const decorations = this.addDecorations(zStart, zEnd);

        this.chunks.push({
            mesh: mesh,
            decorations: decorations,
            zStart: zStart,
            zEnd: zEnd
        });
    }

    createChunkMesh(zStart, zEnd) {
        const segments = 20; 
        const bankHeight = 4;
        const bankSlopeWidth = 8;
        const bankFlatWidth = 50; // Wide flat area for forests
        
        const vertices = [];
        const indices = [];
        const colors = [];
        
        const colorWater = new THREE.Color(0x0099ff);
        const colorBank = new THREE.Color(0x228B22); // Solid Green

        // We will build 3 separate strips or one combined mesh?
        // Combined mesh is easier for management.
        // Structure per slice:
        // 0: Left Flat End
        // 1: Left Bank Top
        // 2: Left Water Edge
        // 3: Right Water Edge
        // 4: Right Bank Top
        // 5: Right Flat End

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const z = zStart + t * (zEnd - zStart);
            
            const point = this.riverPath.getPointAt(z);
            const tangent = this.riverPath.getTangentAt(z);
            const width = this.riverPath.getWidthAt(z);
            
            const up = new THREE.Vector3(0, 1, 0);
            const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
            
            // Calculate points
            const leftWaterEdge = point.clone().add(normal.clone().multiplyScalar(-width/2));
            const rightWaterEdge = point.clone().add(normal.clone().multiplyScalar(width/2));
            
            const leftBankTop = leftWaterEdge.clone().add(normal.clone().multiplyScalar(-bankSlopeWidth));
            leftBankTop.y += bankHeight;
            
            const rightBankTop = rightWaterEdge.clone().add(normal.clone().multiplyScalar(bankSlopeWidth));
            rightBankTop.y += bankHeight;
            
            const leftFlatEnd = leftBankTop.clone().add(normal.clone().multiplyScalar(-bankFlatWidth));
            const rightFlatEnd = rightBankTop.clone().add(normal.clone().multiplyScalar(bankFlatWidth));
            
            // Push vertices
            // 0: Left Flat End
            vertices.push(leftFlatEnd.x, leftFlatEnd.y, leftFlatEnd.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b);
            
            // 1: Left Bank Top
            vertices.push(leftBankTop.x, leftBankTop.y, leftBankTop.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b);
            
            // 2: Left Water Edge
            vertices.push(leftWaterEdge.x, leftWaterEdge.y, leftWaterEdge.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b); // Bank color at water edge
            
            // 3: Right Water Edge
            vertices.push(rightWaterEdge.x, rightWaterEdge.y, rightWaterEdge.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b);
            
            // 4: Right Bank Top
            vertices.push(rightBankTop.x, rightBankTop.y, rightBankTop.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b);
            
            // 5: Right Flat End
            vertices.push(rightFlatEnd.x, rightFlatEnd.y, rightFlatEnd.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b);
        }
        
        // Indices
        for (let i = 0; i < segments; i++) {
            const base = i * 6;
            
            // Left Flat Area (0-1)
            indices.push(base + 0, base + 1, base + 7);
            indices.push(base + 0, base + 7, base + 6);
            
            // Left Slope (1-2)
            indices.push(base + 1, base + 2, base + 8);
            indices.push(base + 1, base + 8, base + 7);
            
            // Right Slope (3-4)
            indices.push(base + 3, base + 4, base + 10);
            indices.push(base + 3, base + 10, base + 9);
            
            // Right Flat Area (4-5)
            indices.push(base + 4, base + 5, base + 11);
            indices.push(base + 4, base + 11, base + 10);
            
            // River Bed (2-3) - Wait, we want water mesh separate?
            // "Water: Generate a simple water mesh between the banks."
            // Let's create a separate water mesh or just add water faces here?
            // If we add water faces here, they will be green if we use shared vertices.
            // We need separate vertices for water if we want it blue.
            // Or we can just add a separate water plane.
            // Let's add a separate water plane in this same function but as part of the same geometry?
            // No, easier to just have a separate mesh for water to handle transparency/shader differently if needed.
            // But for now, let's just add blue vertices for water.
        }
        
        // Create Bank Mesh
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE.DoubleSide,
            flatShading: false
        });
        
        const bankMesh = new THREE.Mesh(geometry, material);
        bankMesh.receiveShadow = true;
        
        // Create Water Mesh
        const waterMesh = this.createWaterMesh(zStart, zEnd, segments);
        bankMesh.add(waterMesh); // Attach to bank mesh for easier management
        
        return bankMesh;
    }

    createWaterMesh(zStart, zEnd, segments) {
        const vertices = [];
        const indices = [];
        const color = new THREE.Color(0x0099ff);
        
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
            
            // Lower slightly to avoid z-fighting with bank edge if they overlap exactly
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
            
            const type = Math.random() > 0.3 ? 'tree' : 'rock';
            
            const decoration = new Decoration({
                scene: this.scene,
                position: position,
                type: type
            });
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
                decoration.destroy();
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
