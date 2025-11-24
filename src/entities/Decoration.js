import * as THREE from 'three';
import { Entity } from './Entity.js';

export class Decoration extends Entity {
    constructor({ scene, position, type }) {
        super({ scene, position });
        this.type = type;
        
        // Overwrite the mesh created by super() with the correct one
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();
        
        switch (this.type) {
            case 'tree':
                this.createPineTree(group);
                break;
            case 'cactus':
                this.createCactus(group);
                break;
            case 'rock':
                this.createRock(group);
                break;
            case 'bush':
                this.createBush(group);
                break;
            case 'dead_tree':
                this.createFractalTree(group);
                break;
            case 'broadleaf_tree':
                this.createBroadleafTree(group);
                break;
            default:
                this.createRock(group);
                break;
        }
        
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        return group;
    }

    createPineTree(group) {
        const scale = 0.8 + Math.random() * 0.6;
        const trunkHeight = 1.5 * scale + Math.random() * 0.5;
        const trunkRadius = 0.3 * scale + Math.random() * 0.1;
        
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkHeight / 2;
        group.add(trunk);
        
        const leavesHeight = 3 * scale + Math.random();
        const leavesRadius = 1.5 * scale + Math.random() * 0.5;
        
        const leavesGeo = new THREE.ConeGeometry(leavesRadius, leavesHeight, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = trunkHeight + leavesHeight / 2 - 0.5;
        group.add(leaves);
    }

    createCactus(group) {
        const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.8 });

        const trunkHeight = 3.5 + Math.random() * 3;
        const trunkRadius = 0.35 + Math.random() * 0.2;
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, 8);
        const trunk = new THREE.Mesh(trunkGeo, cactusMat);
        trunk.position.y = trunkHeight / 2;
        group.add(trunk);

        // Rounded top for trunk
        const topGeo = new THREE.SphereGeometry(trunkRadius, 8, 8);
        const top = new THREE.Mesh(topGeo, cactusMat);
        top.position.y = trunkHeight / 2;
        trunk.add(top);

        const armCount = Math.floor(Math.random() * 4); // 0-3 arms
        for (let i = 0; i < armCount; i++) {
            const arm = new THREE.Group();
            const armRadius = trunkRadius * 0.85;

            // Horizontal part
            const part1Length = 0.4 + Math.random() * 0.3;
            const part1 = new THREE.Mesh(
                new THREE.CylinderGeometry(armRadius, armRadius, part1Length, 6),
                cactusMat
            );
            part1.rotation.z = Math.PI / 2;
            part1.position.x = part1Length / 2;
            arm.add(part1);

            // Elbow joint (Sphere)
            const elbowGeo = new THREE.SphereGeometry(armRadius, 8, 8);
            const elbow = new THREE.Mesh(elbowGeo, cactusMat);
            elbow.position.x = part1Length;
            arm.add(elbow);

            // Vertical part
            const part2Length = 0.7 + Math.random() * 0.8;
            const part2 = new THREE.Mesh(
                new THREE.CylinderGeometry(armRadius, armRadius, part2Length, 6),
                cactusMat
            );
            part2.position.x = part1Length;
            part2.position.y = part2Length / 2;
            arm.add(part2);

            // Rounded top for arm
            const armTopGeo = new THREE.SphereGeometry(armRadius, 8, 8);
            const armTop = new THREE.Mesh(armTopGeo, cactusMat);
            armTop.position.y = part2Length / 2; // Relative to part2 center
            part2.add(armTop);

            // Position the arm
            arm.position.y = trunkHeight * 0.3 + Math.random() * trunkHeight * 0.4;
            arm.rotation.y = Math.random() * Math.PI * 2;
            // Push out slightly to embed in trunk
            arm.position.x = Math.cos(arm.rotation.y) * (trunkRadius * 0.5);
            arm.position.z = Math.sin(arm.rotation.y) * (trunkRadius * 0.5);
            
            group.add(arm);
        }
    }

    createRock(group) {
        const geo = new THREE.DodecahedronGeometry(1 + Math.random());
        const mat = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const mesh = new THREE.Mesh(geo, mat);
        // Sink it a bit
        mesh.position.y = -0.2;
        group.add(mesh);
    }

    createBush(group) {
        const geo = new THREE.IcosahedronGeometry(0.8 + Math.random() * 0.5, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.5;
        mesh.scale.set(1, 0.6, 1);
        group.add(mesh);
    }

    createBroadleafTree(group) {
        this.createFractalTree(group, { hasLeaves: true });
    }

    createFractalTree(group, config = { hasLeaves: false }) {
        const material = new THREE.MeshStandardMaterial({ color: 0x5C4033 });
        const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green
        
        const addBranch = (startPoint, length, radius, direction, depth) => {
            if (depth === 0) {
                if (config.hasLeaves) {
                    const leafGeo = new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.5);
                    const leafMesh = new THREE.Mesh(leafGeo, leafMaterial);
                    leafMesh.position.copy(startPoint);
                    group.add(leafMesh);
                }
                return;
            }

            const endPoint = startPoint.clone().add(direction.clone().multiplyScalar(length));
            
            // Create branch mesh
            const midPoint = startPoint.clone().add(endPoint).multiplyScalar(0.5);
            const orientation = new THREE.Quaternion();
            orientation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
            
            const geometry = new THREE.CylinderGeometry(radius * 0.7, radius, length, 6);
            const branch = new THREE.Mesh(geometry, material);
            branch.position.copy(midPoint);
            branch.setRotationFromQuaternion(orientation);
            group.add(branch);

            // Recursive calls
            const numBranches = 2;
            for (let i = 0; i < numBranches; i++) {
                const angleX = (Math.random() - 0.5) * 1.5;
                const angleZ = (Math.random() - 0.5) * 1.5;
                const newDirection = direction.clone().applyEuler(new THREE.Euler(angleX, 0, angleZ)).normalize();
                
                addBranch(
                    endPoint, 
                    length * 0.7, 
                    radius * 0.7, 
                    newDirection, 
                    depth - 1
                );
            }
        };

        addBranch(new THREE.Vector3(0, 0, 0), 2.5, 0.3, new THREE.Vector3(0, 1, 0), 4);
    }

    // Decorations are static, so update is empty
    update(dt) {}
}
