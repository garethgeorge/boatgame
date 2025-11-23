import * as THREE from 'three';

export class CollectibleManager {
    constructor(scene) {
        this.scene = scene;
        this.collectibles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5; // Seconds
    }

    update(dt, playerPosition) {
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnCollectible(playerPosition);
            this.spawnTimer = 0;
        }

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            
            collectible.mesh.rotation.y += dt * 2.0;
            collectible.mesh.position.y = Math.sin(Date.now() * 0.005 + collectible.offset) * 0.3 + 0.5;

            if (collectible.mesh.position.z < playerPosition.z - 20) {
                this.scene.remove(collectible.mesh);
                this.collectibles.splice(i, 1);
            }
        }
    }

    spawnCollectible(playerPosition) {
        const mesh = this.createBottleMesh();
        
        const spawnDistance = 50;
        const spawnWidth = 40;
        const x = (Math.random() - 0.5) * spawnWidth;
        const z = playerPosition.z + spawnDistance;
        
        mesh.position.set(x, 0, z);
        this.scene.add(mesh);
        
        this.collectibles.push({
            mesh: mesh,
            type: 'bottle',
            offset: Math.random() * 100,
            radius: 0.8
        });
    }

    createBottleMesh() {
        const group = new THREE.Group();
        
        // Bottle body
        const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Neck
        const neckGeo = new THREE.CylinderGeometry(0.1, 0.3, 0.4, 8);
        const neck = new THREE.Mesh(neckGeo, bodyMat);
        neck.position.y = 0.7;
        group.add(neck);
        
        // Message inside (white paper)
        const paperGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
        const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const paper = new THREE.Mesh(paperGeo, paperMat);
        group.add(paper);

        group.castShadow = true;
        return group;
    }
}
