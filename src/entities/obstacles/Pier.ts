import * as planck from 'planck';
import * as THREE from 'three';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';

export class Pier extends Entity {

    public static readonly MIN_LENGTH_WITH_DEPOT = 10;

    // Cached materials and geometry
    private static deckMaterial: THREE.MeshToonMaterial | null = null;
    private static pileMesh: THREE.Mesh | null = null;

    private static getDeckMaterial(): THREE.MeshToonMaterial {
        if (Pier.deckMaterial) return Pier.deckMaterial;

        // Load and create deck material with texture
        const textureLoader = new THREE.TextureLoader();
        const deckTexture = textureLoader.load('/assets/deck-plank-texture.png');
        deckTexture.wrapS = THREE.RepeatWrapping;
        deckTexture.wrapT = THREE.RepeatWrapping;
        deckTexture.repeat.set(4, 1);

        const deckMaterial = new THREE.MeshToonMaterial({ map: deckTexture });
        deckMaterial.color.set(0xd48e43);

        Pier.deckMaterial = deckMaterial;

        return Pier.deckMaterial
    }

    private static getPileMesh(): THREE.Mesh {
        if (Pier.pileMesh) return Pier.pileMesh;

        // Load and create pile material with texture
        const textureLoader = new THREE.TextureLoader();
        const pileTexture = textureLoader.load('/assets/wood-piling-texture.png');
        pileTexture.wrapS = THREE.RepeatWrapping;
        pileTexture.wrapT = THREE.RepeatWrapping;
        pileTexture.repeat.set(0.25, 0.25);

        const pileMaterial = new THREE.MeshToonMaterial({ map: pileTexture });
        pileMaterial.color.set(0x8B4513);

        // Create pile geometry and mesh
        const pileGeometry = new THREE.CylinderGeometry(0.2, 0.2, 4.0, 8);
        Pier.pileMesh = new THREE.Mesh(pileGeometry, pileMaterial);

        return Pier.pileMesh;
    }

    constructor(x: number, y: number, length: number, angle: number, physicsEngine: PhysicsEngine, hasDepot: boolean = false) {
        super();

        const width = hasDepot ? 6 : 4;

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

        // Deck (geometry is unique per pier due to varying length/width)
        const deckGeo = new THREE.BoxGeometry(length, 0.5, width);
        this.disposer.add(deckGeo);
        const deck = new THREE.Mesh(deckGeo, Pier.getDeckMaterial());
        deck.position.y = 1.5; // Raised up
        mesh.add(deck);

        // Piles (Supports) - use cloned instances of the cached pile mesh
        const numPiles = Math.floor(length / 3);
        for (let i = 0; i <= numPiles; i++) {
            // Calculate x position relative to center
            // Length spans from -length/2 to +length/2
            const xPos = -length / 2 + (length / numPiles) * i;

            // Two piles per row (front and back)
            const pile1 = Pier.getPileMesh().clone();
            pile1.position.set(xPos, 0, -width / 2);
            mesh.add(pile1);

            const pile2 = Pier.getPileMesh().clone();
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
