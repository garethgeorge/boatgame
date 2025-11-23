import * as THREE from 'three';

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2.0; // Seconds
    }

    update(dt, playerPosition) {
        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnObstacle(playerPosition);
            this.spawnTimer = 0;
        }

        // Update and remove obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            
            // Simple floating animation
            obstacle.mesh.position.y = Math.sin(Date.now() * 0.005 + obstacle.offset) * 0.2;
            obstacle.mesh.rotation.y += dt * 0.5;

            // Despawn if too far behind
            if (obstacle.mesh.position.z < playerPosition.z - 20) {
                this.scene.remove(obstacle.mesh);
                this.obstacles.splice(i, 1);
            }
        }
    }

    spawnObstacle(playerPosition) {
        const type = Math.random() > 0.5 ? 'crocodile' : 'trash';
        const mesh = this.createObstacleMesh(type);
        
        // Spawn ahead of player
        const spawnDistance = 50;
        const spawnWidth = 40;
        const x = (Math.random() - 0.5) * spawnWidth;
        const z = playerPosition.z + spawnDistance;
        
        mesh.position.set(x, 0, z);
        this.scene.add(mesh);
        
        this.obstacles.push({
            mesh: mesh,
            type: type,
            offset: Math.random() * 100,
            radius: 1.0 // Collision radius
        });
    }

    createObstacleMesh(type) {
        const group = new THREE.Group();
        
        if (type === 'crocodile') {
            const bodyGeo = new THREE.BoxGeometry(1, 0.5, 3);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00aa00 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            group.add(body);
            
            const snoutGeo = new THREE.BoxGeometry(0.8, 0.4, 1.5);
            const snout = new THREE.Mesh(snoutGeo, bodyMat);
            snout.position.z = -2;
            group.add(snout);
            
            // Eyes
            const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
            leftEye.position.set(0.3, 0.4, -1.5);
            const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
            rightEye.position.set(-0.3, 0.4, -1.5);
            group.add(leftEye);
            group.add(rightEye);

        } else { // Trash
            const geo = new THREE.DodecahedronGeometry(0.8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
        }
        
        group.castShadow = true;
        return group;
    }
}
