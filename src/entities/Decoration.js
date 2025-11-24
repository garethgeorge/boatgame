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
        
        if (this.type === 'tree') {
            const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 2, 6);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1;
            group.add(trunk);
            
            const leavesGeo = new THREE.ConeGeometry(2, 4, 8);
            const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 3;
            group.add(leaves);
        } else { // 'rock'
            const geo = new THREE.DodecahedronGeometry(1 + Math.random());
            const mat = new THREE.MeshStandardMaterial({ color: 0x808080 });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
        }
        
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
            }
        });
        
        return group;
    }

    // Decorations are static, so update is empty
    update(dt) {}
}
