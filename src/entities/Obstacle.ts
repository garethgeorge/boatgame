import * as THREE from 'three';
import { Entity, EntityOptions } from './Entity';

export interface ObstacleOptions extends EntityOptions {
    type: string;
}

export class Obstacle extends Entity {
    type: string;
    offset: number;
    size: THREE.Vector3;
    rotation: number;
    isHit: boolean;
    active: boolean;
    markForRemoval: boolean;

    constructor(options: ObstacleOptions) {
        super(options);
        this.type = options.type;
        this.offset = Math.random() * 100;
        this.size = new THREE.Vector3(1, 1, 1); // Default size
        this.rotation = 0;
        this.isHit = false;
        this.active = true;
        this.markForRemoval = false;

        // Re-create mesh based on type
        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    createMesh() {
        const group = new THREE.Group();

        if (this.type === 'crocodile') {
            const bodyGeo = new THREE.BoxGeometry(1, 0.5, 3);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00aa00, roughness: 0.8 });
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

            // Tail
            const tailGeo = new THREE.BoxGeometry(0.6, 0.3, 2);
            const tail = new THREE.Mesh(tailGeo, bodyMat);
            tail.position.z = 2.5;
            group.add(tail);

            this.size = new THREE.Vector3(1.0, 0.5, 6.5); // Approximate OBB size

        } else if (this.type === 'tire') {
            const geo = new THREE.TorusGeometry(0.6, 0.25, 16, 32);
            const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = Math.PI / 2; // Lay flat
            group.add(mesh);

        } else if (this.type === 'beachball') {
            const geo = new THREE.SphereGeometry(0.5, 16, 16);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xff0000,
                roughness: 0.4,
                metalness: 0.1
            });
            // Simple stripes via vertex colors would be better, but solid color for now
            // Or maybe multiple segments? Let's stick to simple red ball for now or random color
            mat.color.setHSL(Math.random(), 1.0, 0.5);
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);

        } else if (this.type === 'log') {
            // Length: 3 to 10 (was 3 to 5)
            const length = 3 + Math.random() * 7;
            const radius = 0.4 + Math.random() * 0.2;
            const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 1.0 });
            const mesh = new THREE.Mesh(geo, mat);
            // Random rotation handled in update or init?
            // Let's rotate the mesh here to align with Z then rotate group
            mesh.rotation.x = Math.PI / 2;
            mesh.rotation.z = Math.random() * Math.PI; // Random roll
            group.add(mesh);

            // Adjust collision radius roughly
            this.radius = length * 0.4;
            this.size = new THREE.Vector3(radius * 2, radius * 2, length); // Local size (before rotation)

            // Random Y rotation
            this.rotation = Math.random() * Math.PI * 2;
            group.rotation.y = this.rotation;
            // Note: The mesh is rotated, so we need to handle that.
            // In createMesh: mesh.rotation.x = Math.PI / 2; mesh.rotation.z = random;
            // The 'rectRotation' passed to physics should be the Y rotation of the entity.
            // But wait, the log rotates around Z?
            // If the log is just a cylinder lying flat, its bounding box in local space is (diameter, diameter, length).
            // But if it's rotated randomly around Y (which Obstacle.update does for others, but log has random roll),
            // Obstacle.update says: } else if (this.type === 'tire' || this.type === 'log') { // Just float }
            // So it doesn't rotate in update.
            // In createMesh: mesh.rotation.z = Math.random() * Math.PI;
            // This rotates the cylinder around its axis (rolling). It doesn't affect the bounding box orientation in XZ plane if it's aligned with Z.
            // Wait, cylinder default is Y-up.
            // mesh.rotation.x = Math.PI / 2 puts it along Z.
            // mesh.rotation.z = random rolls it.
            // So the log is aligned with Z axis in local space.
            // So size is (diameter, diameter, length).
            // And entity.rotation (which is Y rotation) determines its orientation in world.
            // But Obstacle doesn't set this.rotation for logs?
            // RiverGenerator sets position.
            // Decoration (parent of Obstacle?) No, Obstacle extends Entity.
            // RiverGenerator: decorations.push(new Obstacle(...));
            // It doesn't set rotation. So rotation is 0.
            // So logs are always aligned with Z?
            // "Log: Floating cylinder with random roll."
            // If they are always Z-aligned, they will look weird.
            // Let's give them a random Y rotation in constructor.
            this.rotation = Math.random() * Math.PI * 2;
            this.mesh.rotation.y = this.rotation; // Apply to mesh group
        } else { // 'trash' fallback
            const geo = new THREE.DodecahedronGeometry(0.8);
            const mat = new THREE.MeshStandardMaterial({ color: 0x555555 });
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

    update(dt, playerPosition) {
        if (this.isHit) {
            // Animation: Sink and fade
            this.mesh.position.y -= dt * 2.0; // Sink

            // Fade out
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity -= dt * 2.0;
                    if (child.material.opacity < 0) child.material.opacity = 0;
                }
            });

            if (this.mesh.children[0].material.opacity <= 0) {
                this.markForRemoval = true;
            }
            return;
        }

        // Bobbing
        this.mesh.position.y = Math.sin(Date.now() * 0.005 + this.offset) * 0.1;

        if (this.type === 'crocodile') {
            // Swim towards player if close
            if (playerPosition) {
                const dist = this.position.distanceTo(playerPosition);
                if (dist < 30) {
                    const dir = new THREE.Vector3().subVectors(playerPosition, this.position).normalize();
                    dir.y = 0;
                    // Move
                    this.position.add(dir.multiplyScalar(dt * 2.0)); // Swim speed
                    // Rotate to face player
                    const angle = Math.atan2(dir.x, dir.z);
                    this.mesh.rotation.y = angle + Math.PI; // Model faces -Z?
                }
            }
        } else if (this.type === 'tire' || this.type === 'log') {
            // Just float
        } else if (this.type === 'beachball') {
            // Bob higher
            this.mesh.position.y = Math.sin(Date.now() * 0.005 + this.offset) * 0.2 + 0.2;
        } else {
            this.mesh.rotation.y += dt * 0.5;
        }

        // Sync mesh position (since we might have moved it in logic)
        this.mesh.position.x = this.position.x;
        this.mesh.position.z = this.position.z;
        // y is handled by bobbing above
    }

    hit() {
        if (this.isHit) return;
        this.isHit = true;
        this.active = false; // Disable further collision
    }
}
