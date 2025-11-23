import * as THREE from 'three';

export class RiverGenerator {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.chunkSize = 100; // Length of each river segment
        this.riverWidth = 40;
        this.lastPoint = new THREE.Vector3(0, 0, 0);
        this.lastTangent = new THREE.Vector3(0, 0, -1);
        
        // Initial straight segment
        this.generateChunk(true);
        this.generateChunk();
        this.generateChunk();
    }

    update(playerPosition) {
        // Generate new chunks ahead
        const lastChunk = this.chunks[this.chunks.length - 1];
        if (lastChunk.endPoint.z > playerPosition.z - 200) { // Keep generating ahead
            this.generateChunk();
        }

        // Remove old chunks
        if (this.chunks[0].endPoint.z > playerPosition.z + 100) {
            this.removeChunk(this.chunks[0]);
            this.chunks.shift();
        }
    }

    generateChunk(isStraight = false) {
        const points = [this.lastPoint.clone()];
        const segments = 5;
        const segmentLength = this.chunkSize / segments;
        
        let currentPoint = this.lastPoint.clone();
        let currentTangent = this.lastTangent.clone();

        for (let i = 0; i < segments; i++) {
            // Wiggle the tangent
            if (!isStraight) {
                const angle = (Math.random() - 0.5) * 0.5; // Random turn
                currentTangent.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                currentTangent.normalize();
            }
            
            currentPoint.add(currentTangent.clone().multiplyScalar(segmentLength));
            points.push(currentPoint.clone());
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const mesh = this.createRiverMesh(curve);
        this.scene.add(mesh);

        // Bank decorations
        const decorations = this.addDecorations(curve);

        this.chunks.push({
            mesh: mesh,
            curve: curve,
            decorations: decorations,
            startPoint: this.lastPoint.clone(),
            endPoint: currentPoint.clone()
        });

        this.lastPoint = currentPoint;
        this.lastTangent = currentTangent;
    }

    addDecorations(curve) {
        const decorations = [];
        const count = 10; // Trees/Rocks per chunk
        
        for (let i = 0; i < count; i++) {
            const t = Math.random();
            const point = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            // Random side (Left or Right bank)
            const side = Math.random() > 0.5 ? 1 : -1;
            const distance = (this.riverWidth / 2) + 2 + Math.random() * 5;
            
            const position = point.clone().add(normal.multiplyScalar(side * distance));
            position.y = 2; // Bank height
            
            const type = Math.random() > 0.3 ? 'tree' : 'rock';
            const mesh = this.createDecorationMesh(type);
            mesh.position.copy(position);
            
            // Random rotation
            mesh.rotation.y = Math.random() * Math.PI * 2;
            
            this.scene.add(mesh);
            decorations.push(mesh);
        }
        return decorations;
    }

    createDecorationMesh(type) {
        const group = new THREE.Group();
        
        if (type === 'tree') {
            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 2, 6);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1;
            group.add(trunk);
            
            // Leaves
            const leavesGeo = new THREE.ConeGeometry(2, 4, 8);
            const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 3;
            group.add(leaves);
        } else {
            // Rock
            const geo = new THREE.DodecahedronGeometry(1 + Math.random());
            const mat = new THREE.MeshStandardMaterial({ color: 0x808080 });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
        }
        
        group.castShadow = true;
        return group;
    }

    createRiverMesh(curve) {
        const segments = 50; // Resolution along the curve
        const riverWidth = this.riverWidth;
        const bankWidth = 10;
        const bankHeight = 5;
        
        const vertices = [];
        const indices = [];
        const colors = [];
        
        const colorWater = new THREE.Color(0x0099ff);
        const colorBank = new THREE.Color(0x228B22);

        // Generate vertices
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            
            // Calculate side vector (normal)
            // We assume the river is mostly flat, so Up is (0, 1, 0)
            const up = new THREE.Vector3(0, 1, 0);
            const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
            
            // Profile points relative to center point
            // 0: Left Bank Top
            // 1: Left Bank Bottom (Water edge)
            // 2: Right Bank Bottom (Water edge)
            // 3: Right Bank Top
            
            const leftBankTop = point.clone().add(normal.clone().multiplyScalar(-riverWidth/2 - bankWidth));
            leftBankTop.y += bankHeight;
            
            const leftBankBottom = point.clone().add(normal.clone().multiplyScalar(-riverWidth/2));
            leftBankBottom.y += 0; // Water level
            
            const rightBankBottom = point.clone().add(normal.clone().multiplyScalar(riverWidth/2));
            rightBankBottom.y += 0;
            
            const rightBankTop = point.clone().add(normal.clone().multiplyScalar(riverWidth/2 + bankWidth));
            rightBankTop.y += bankHeight;
            
            // Push vertices and colors
            vertices.push(leftBankTop.x, leftBankTop.y, leftBankTop.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b);
            
            vertices.push(leftBankBottom.x, leftBankBottom.y, leftBankBottom.z);
            colors.push(colorWater.r, colorWater.g, colorWater.b); // Blend? Or hard edge? Let's do hard edge by duplicating vertices if needed, but for low poly shared is fine
            
            vertices.push(rightBankBottom.x, rightBankBottom.y, rightBankBottom.z);
            colors.push(colorWater.r, colorWater.g, colorWater.b);
            
            vertices.push(rightBankTop.x, rightBankTop.y, rightBankTop.z);
            colors.push(colorBank.r, colorBank.g, colorBank.b);
        }
        
        // Generate indices
        for (let i = 0; i < segments; i++) {
            const base = i * 4;
            
            // Left Bank Face
            // TopL, BotL, NextBotL, NextTopL
            indices.push(base + 0, base + 1, base + 5);
            indices.push(base + 0, base + 5, base + 4);
            
            // River Bed Face
            // BotL, BotR, NextBotR, NextBotL
            indices.push(base + 1, base + 2, base + 6);
            indices.push(base + 1, base + 6, base + 5);
            
            // Right Bank Face
            // BotR, TopR, NextTopR, NextBotR
            indices.push(base + 2, base + 3, base + 7);
            indices.push(base + 2, base + 7, base + 6);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
            flatShading: true // Low poly look
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        return mesh;
    }
    
    removeChunk(chunk) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
        
        if (chunk.decorations) {
            chunk.decorations.forEach(mesh => {
                this.scene.remove(mesh);
                // Traverse and dispose geometry/material if needed for complex objects
            });
        }
    }

    getRiverTangent(z) {
        // Find which chunk this Z belongs to
        // This is a simplification, ideally we project point to curve
        for (const chunk of this.chunks) {
            if (z <= chunk.startPoint.z && z >= chunk.endPoint.z) {
                // Approximate t
                const t = (chunk.startPoint.z - z) / (chunk.startPoint.z - chunk.endPoint.z);
                return chunk.curve.getTangent(Math.max(0, Math.min(1, t)));
            }
        }
        return new THREE.Vector3(0, 0, -1); // Default forward
    }
    
    getRiverCenter(z) {
         for (const chunk of this.chunks) {
            if (z <= chunk.startPoint.z && z >= chunk.endPoint.z) {
                const t = (chunk.startPoint.z - z) / (chunk.startPoint.z - chunk.endPoint.z);
                return chunk.curve.getPoint(Math.max(0, Math.min(1, t)));
            }
        }
        return new THREE.Vector3(0, 0, z);
    }
}
