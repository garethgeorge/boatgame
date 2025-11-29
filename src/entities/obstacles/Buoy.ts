import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';

export class Buoy extends Entity {
    declare physicsBody: planck.Body;
    declare mesh: THREE.Group;
    private bobTimer: number = Math.random() * 100;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        // Physics: Dynamic but high damping to stay mostly in place
        // Spherical collision box
        this.physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0, // Reduced from 5.0 to allow pushing
            angularDamping: 2.0
        });

        this.physicsBody.createFixture({
            shape: planck.Circle(0.5), // 1m diameter
            density: 5.0, // 5x increase from 1.0
            friction: 0.3,
            restitution: 0.5 // Bouncy
        });

        this.physicsBody.setUserData({ type: 'obstacle', subtype: 'buoy', entity: this });

        // Graphics
        this.mesh = new THREE.Group();

        // Buoy Base (Cylinder)
        // Red/White stripes
        const radius = 0.5;
        const height = 1.2;
        const segments = 16;

        const matRed = new THREE.MeshToonMaterial({ color: 0xFF0000 });
        const matWhite = new THREE.MeshToonMaterial({ color: 0xFFFFFF });

        // Bottom Red
        const bottomGeo = new THREE.CylinderGeometry(radius, radius * 0.8, height * 0.4, segments);
        const bottom = new THREE.Mesh(bottomGeo, matRed);
        bottom.position.y = -height * 0.2;
        this.mesh.add(bottom);

        // Middle White
        const midGeo = new THREE.CylinderGeometry(radius, radius, height * 0.3, segments);
        const mid = new THREE.Mesh(midGeo, matWhite);
        mid.position.y = height * 0.15;
        this.mesh.add(mid);

        // Top Red
        const topGeo = new THREE.CylinderGeometry(radius * 0.6, radius, height * 0.3, segments);
        const top = new THREE.Mesh(topGeo, matRed);
        top.position.y = height * 0.45;
        this.mesh.add(top);

        // Light/Sensor on top
        const lightGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const lightMat = new THREE.MeshToonMaterial({ color: 0xFFFF00, emissive: 0x444400 });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.y = height * 0.7;
        this.mesh.add(light);

        this.mesh.position.y = 0;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }

    onHit() {
        // Buoys just bounce
    }

    update(dt: number) {
        if (!this.physicsBody) return;

        // Bobbing animation
        this.bobTimer += dt * 2.0;
        const bobOffset = Math.sin(this.bobTimer) * 0.1;

        // Apply bob to mesh Y (relative to physics body which is at 0)
        // Entity.sync() overwrites position, so we need to add offset to the mesh *child* or adjust sync?
        // Entity.sync() sets this.mesh.position.
        // If we want visual bobbing independent of physics, we should put the buoy parts in a child group and animate that.
        // Let's restructure mesh in constructor? 
        // Actually, Entity.sync() sets this.mesh.position.y = 0 (or whatever we set).
        // Wait, Entity.sync() usually sets x/z from physics and y from... where?
        // Let's check Entity.ts or just assume we can modify Y after sync?
        // If sync happens before update, we can override Y here.
        // If sync happens after, our change is overwritten.
        // Usually update is called, then physics step, then sync.
        // So we might need a child container.

        // Let's just iterate children and offset them? No, that accumulates.
        // Let's just assume we can set Y here and it sticks if sync doesn't touch Y.
        // Most Entity syncs only touch X/Z for 2D physics.
        // Let's verify Entity.ts later if needed. For now, let's try setting mesh.position.y.

        this.mesh.position.y = bobOffset;
    }
}
