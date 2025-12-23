import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { GraphicsUtils } from '../../core/GraphicsUtils';

export class Log extends Entity {

    private static barkMaterial: THREE.MeshToonMaterial | null = null;
    private static endMaterial: THREE.MeshToonMaterial | null = null;

    private static getBarkMaterial(): THREE.MeshToonMaterial {
        if (Log.barkMaterial) return Log.barkMaterial;

        // Load and create deck material with texture
        const textureLoader = new THREE.TextureLoader();
        const deckTexture = textureLoader.load('assets/redwood-bark-texture.png');
        deckTexture.wrapS = THREE.RepeatWrapping;
        deckTexture.wrapT = THREE.RepeatWrapping;
        deckTexture.repeat.set(4, 8);

        const deckMaterial = new THREE.MeshToonMaterial({ map: deckTexture });
        deckMaterial.name = 'Log bark';
        deckMaterial.color.set(0xa87660);

        Log.barkMaterial = deckMaterial;
        GraphicsUtils.registerObject(deckMaterial);

        return Log.barkMaterial;
    }

    private static getEndMaterial(): THREE.MeshToonMaterial {
        if (Log.endMaterial) return Log.endMaterial;

        // Load and create end material with texture
        const textureLoader = new THREE.TextureLoader();
        const endTexture = textureLoader.load('assets/redwood-ends-texture.png');
        // No wrapping needed for the ends, texture should fit the circular cap
        endTexture.wrapS = THREE.ClampToEdgeWrapping;
        endTexture.wrapT = THREE.ClampToEdgeWrapping;

        // Center the texture on the circular ends
        endTexture.center.set(0.5, 0.5);

        const endMaterial = new THREE.MeshToonMaterial({ map: endTexture });
        endMaterial.name = 'Log end';
        endMaterial.color.set(0xe7c55e);

        Log.endMaterial = endMaterial;
        GraphicsUtils.registerObject(endMaterial);

        return Log.endMaterial;
    }


    constructor(x: number, y: number, length: number, physicsEngine: PhysicsEngine) {
        super();

        // Log should be perpendicular to the river flow (roughly X-aligned) to block path
        // Physics Box takes (halfWidth, halfHeight).
        // We want length along X. So halfWidth = length/2, halfHeight = 0.5.

        const physicsBody = physicsEngine.world.createBody({
            type: 'dynamic',
            position: planck.Vec2(x, y),
            linearDamping: 2.0, // Heavy water resistance
            angularDamping: 1.0,
            bullet: true
        });
        this.physicsBodies.push(physicsBody);

        physicsBody.createFixture({
            shape: planck.Box(length / 2, 0.6), // 1.2m thick log
            density: 100.0, // Heavy wood (5x increase from 20.0)
            friction: 0.8, // Rough
            restitution: 0.1
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'log', entity: this });

        // Graphics
        // Cylinder is Y-up by default.
        // We want it along X-axis to match Physics Box(length, thickness).
        // Rotate around Z axis by 90 deg.
        const geo = new THREE.CylinderGeometry(0.6, 0.6, length, 12);
        geo.name = 'Log';

        // Create material array: [side, top cap, bottom cap]
        const materials = [
            Log.getBarkMaterial(),  // Side of cylinder
            Log.getEndMaterial(),    // Top cap
            Log.getEndMaterial()     // Bottom cap
        ];

        const mesh = GraphicsUtils.createMesh(geo, materials, 'LogMesh');
        this.meshes.push(mesh);

        mesh.rotation.z = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

    }

    wasHitByPlayer() {
        // Logs don't break, they block!
    }

    update(dt: number) {
        // Just floats
    }
}
