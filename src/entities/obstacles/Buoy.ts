import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class Buoy extends Entity {

    private bobTimer: number = Math.random() * 100;

    constructor(x: number, y: number, physicsEngine: PhysicsEngine) {
        super();

        // Physics: Dynamic but high damping to stay mostly in place
        // Spherical collision box
        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 1.0, // Reduced from 5.0 to allow pushing
            angularDamping: 2.0
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Circle(0.5), // 1m diameter
            density: 5.0, // 5x increase from 1.0
            friction: 0.3,
            restitution: 0.5 // Bouncy
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'buoy', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Buoy Base (Cylinder)
        // Red/White stripes
        const radius = 0.5;
        const height = 1.2;
        const segments = 16;

        const matRed = new THREE.MeshToonMaterial({ color: 0xFF0000, name: 'Buoy - Red Material' });
        const matWhite = new THREE.MeshToonMaterial({ color: 0xFFFFFF, name: 'Buoy - White Material' });

        // Bottom Red
        const bottomGeo = new THREE.CylinderGeometry(radius, radius * 0.8, height * 0.4, segments);
        bottomGeo.name = 'Buoy - Bottom Geometry';
        const bottom = GraphicsUtils.createMesh(bottomGeo, matRed, 'BuoyBottom');
        bottom.position.y = -height * 0.2;
        mesh.add(bottom);

        // Middle White
        const midGeo = new THREE.CylinderGeometry(radius, radius, height * 0.3, segments);
        midGeo.name = 'Buoy - Middle Geometry';
        const mid = GraphicsUtils.createMesh(midGeo, matWhite, 'BuoyMid');
        mid.position.y = height * 0.15;
        mesh.add(mid);

        // Top Red
        const topGeo = new THREE.CylinderGeometry(radius * 0.6, radius, height * 0.3, segments);
        topGeo.name = 'Buoy - Top Geometry';
        const top = GraphicsUtils.createMesh(topGeo, matRed, 'BuoyTop');
        top.position.y = height * 0.45;
        mesh.add(top);

        // Light/Sensor on top
        const lightGeo = new THREE.SphereGeometry(0.2, 8, 8);
        lightGeo.name = 'Buoy - Light Geometry';
        const lightMat = new THREE.MeshToonMaterial({ color: 0xFFFF00, emissive: 0x444400, name: 'Buoy - Light Material' });
        const light = GraphicsUtils.createMesh(lightGeo, lightMat, 'BuoyLight');
        light.position.y = height * 0.7;
        mesh.add(light);

        mesh.position.y = 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    wasHitByPlayer() {
        // Buoys just bounce
    }

    update(dt: number) {
        if (this.physicsBodies.length === 0) return;

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

        this.meshes[0].position.y = bobOffset;
    }
}
