import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

export class Pier extends Entity {

    public static readonly MIN_LENGTH_WITH_DEPOT = 10;

    constructor(x: number, y: number, length: number, angle: number, physicsEngine: PhysicsEngine, hasDepot: boolean = false) {
        super();

        const width = hasDepot ? 6 : 2;

        // Static body
        const physicsBody = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            angle: angle // Set rotation
        });
        this.physicsBodies.push(physicsBody);

        // Box is axis-aligned in local coords.
        // Length is along X (extending from bank). Width is along Y (thickness).
        // shape: Box(halfWidth, halfHeight)
        // We want length to be the long dimension.
        physicsBody.createFixture({
            shape: planck.Box(length / 2, width / 2),
            friction: 0.5
        });

        physicsBody.setUserData({ type: 'obstacle', subtype: 'pier', entity: this });

        // Graphics
        const mesh = new THREE.Group();
        this.meshes.push(mesh);

        // Deck
        const deckGeo = new THREE.BoxGeometry(length, 0.5, width); // Thinner deck
        this.disposer.add(deckGeo);
        const deckMat = new THREE.MeshToonMaterial({ color: 0xA0522D }); // Sienna
        this.disposer.add(deckMat);
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.y = 1.5; // Raised up
        mesh.add(deck);

        // Piles (Supports)
        const pileGeo = new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8);
        this.disposer.add(pileGeo);
        const pileMat = new THREE.MeshToonMaterial({ color: 0x8B4513 }); // Darker wood
        this.disposer.add(pileMat);

        const numPiles = Math.floor(length / 3);
        for (let i = 0; i <= numPiles; i++) {
            // Calculate x position relative to center
            // Length spans from -length/2 to +length/2
            const xPos = -length / 2 + (length / numPiles) * i;

            // Two piles per row (front and back)
            const pile1 = new THREE.Mesh(pileGeo, pileMat);
            pile1.position.set(xPos, 0, -width / 2);
            mesh.add(pile1);

            const pile2 = new THREE.Mesh(pileGeo, pileMat);
            pile2.position.set(xPos, 0, width / 2);
            mesh.add(pile2);
        }

        // Add depot if requested
        if (hasDepot) {
            const depot = Decorations.getDepot();
            depot.rotation.y = -Math.PI / 2;
            // Position at the start of the pier (shore end) at -length/2
            depot.position.set(-length / 2 + 3, 1.5, 0);
            mesh.add(depot);
        }

        // Apply initial rotation to mesh to match physics
        // Physics angle is counter-clockwise radians.
        // ThreeJS rotation.y is counter-clockwise (if looking from top? No, usually Y-up, rotation around Y).
        // Entity.sync() does: this.mesh.rotation.y = -angle;
        // So we should set it similarly or just let sync() handle it if it was dynamic.
        // Since it's static, sync() might not be called every frame if we optimized it, 
        // but EntityManager calls sync() every frame for all entities.
        // So we don't strictly need to set it here, but good for init.
        mesh.rotation.y = -angle;
        mesh.position.set(x, 0, y);
    }

    update(dt: number) {
        // Static
    }
}
