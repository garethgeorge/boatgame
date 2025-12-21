import * as planck from 'planck';
import {
    TransformNode,
    Mesh,
    MeshBuilder,
    StandardMaterial,
    Texture,
    Color3,
    Vector3,
    Quaternion,
    MultiMaterial,
    SubMesh,
    Engine
} from '@babylonjs/core';
import { Entity } from '../../core/Entity';
import { PhysicsEngine } from '../../core/PhysicsEngine';
import { Decorations } from '../../world/Decorations';
import { CollectedBottles } from '../CollectedBottles';

export class Pier extends Entity {

    public static readonly MIN_LENGTH_WITH_DEPOT = 10;

    // Cached materials and geometry
    private static deckMaterial: StandardMaterial | null = null;
    private static pileMaterial: StandardMaterial | null = null;
    private static signMultiMaterial: MultiMaterial | null = null;

    public collectedBottles: CollectedBottles | null = null;

    private static getDeckMaterial(scene: any): StandardMaterial {
        if (Pier.deckMaterial) return Pier.deckMaterial;

        // Load and create deck material with texture
        const deckTexture = new Texture('assets/deck-plank-texture.png', scene);
        deckTexture.uScale = 4;
        deckTexture.vScale = 1;

        const deckMaterial = new StandardMaterial("deckMat", scene);
        deckMaterial.diffuseTexture = deckTexture;
        deckMaterial.diffuseColor = Color3.FromHexString("#d48e43");
        deckMaterial.specularColor = new Color3(0, 0, 0); // Matte

        Pier.deckMaterial = deckMaterial;

        return Pier.deckMaterial
    }

    private static getPileMaterial(scene: any): StandardMaterial {
        if (Pier.pileMaterial) return Pier.pileMaterial;

        // Load and create pile material with texture
        const pileTexture = new Texture('assets/wood-piling-texture.png', scene);
        pileTexture.uScale = 0.25;
        pileTexture.vScale = 0.25;

        const pileMaterial = new StandardMaterial("pileMat", scene);
        pileMaterial.diffuseTexture = pileTexture;
        pileMaterial.diffuseColor = Color3.FromHexString("#8B4513");
        pileMaterial.specularColor = new Color3(0, 0, 0);

        Pier.pileMaterial = pileMaterial;

        return Pier.pileMaterial;
    }

    private static getSignMultiMaterial(scene: any): MultiMaterial {
        if (Pier.signMultiMaterial) return Pier.signMultiMaterial;

        const signFrontTexture = new Texture('assets/dock-sign.png', scene);
        // Top Half for Front
        signFrontTexture.uScale = 1;
        signFrontTexture.vScale = 0.5;
        signFrontTexture.vOffset = 0.5;

        const signBackTexture = new Texture('assets/dock-sign.png', scene);
        // Bottom Half for Back
        signBackTexture.uScale = 1;
        signBackTexture.vScale = 0.5;
        signBackTexture.vOffset = 0.0;

        const frontMat = new StandardMaterial("signFrontMat", scene);
        frontMat.diffuseTexture = signFrontTexture;
        frontMat.useAlphaFromDiffuseTexture = true;
        frontMat.specularColor = new Color3(0, 0, 0);

        const backMat = new StandardMaterial("signBackMat", scene);
        backMat.diffuseTexture = signBackTexture;
        backMat.useAlphaFromDiffuseTexture = true;
        backMat.specularColor = new Color3(0, 0, 0);

        const sideMat = new StandardMaterial("signSideMat", scene);
        sideMat.alpha = 0; // Transparent sides

        const multiMat = new MultiMaterial("signMultiMat", scene);
        multiMat.subMaterials.push(sideMat); // 0
        multiMat.subMaterials.push(sideMat); // 1
        multiMat.subMaterials.push(sideMat); // 2
        multiMat.subMaterials.push(sideMat); // 3
        multiMat.subMaterials.push(frontMat); // 4 (Face 0 in Babylon depending on creation?)
        multiMat.subMaterials.push(backMat); // 5

        Pier.signMultiMaterial = multiMat;

        return Pier.signMultiMaterial;
    }

    private static readonly DOCK_LENGTH: number = 4.0;
    private static readonly DOCK_DEPTH: number = 3.0;
    public static readonly MIN_LENGTH_FOR_DOCK: number = this.DOCK_LENGTH + 2.0;

    constructor(x: number, y: number, length: number, angle: number, physicsEngine: PhysicsEngine, hasDepot: boolean = false) {
        super();

        const width = hasDepot ? 6 : 4;
        const scene = physicsEngine.world.getBodyList()?.getWorld() ? Engine.LastCreatedScene : null; // Hack to get scene if needed, but we'll use Engine

        // Visuals Root
        const mesh = new TransformNode("pierRoot");
        this.meshes.push(mesh);

        // Physics Body
        const physicsBody = physicsEngine.world.createBody({
            type: 'static',
            position: planck.Vec2(x, y),
            angle: angle // Set rotation
        });
        this.physicsBodies.push(physicsBody);
        physicsBody.setUserData({ type: 'obstacle', subtype: 'pier', entity: this });

        // Build geometry and collect meshes for merging
        const deckMeshes: Mesh[] = [];
        const pileMeshes: Mesh[] = [];

        if (hasDepot && length > Pier.MIN_LENGTH_FOR_DOCK) {
            this.buildDockedPier(length, width, physicsBody, mesh, deckMeshes, pileMeshes);
        } else {
            this.buildStandardPier(length, width, physicsBody, mesh, deckMeshes, pileMeshes);
        }

        // Merge Meshes
        if (deckMeshes.length > 0) {
            const mergedDeck = Mesh.MergeMeshes(deckMeshes, true, true, undefined, false, true);
            if (mergedDeck) {
                mergedDeck.parent = mesh;
                mergedDeck.material = Pier.getDeckMaterial(mergedDeck.getScene());
            }
        }
        if (pileMeshes.length > 0) {
            const mergedPiles = Mesh.MergeMeshes(pileMeshes, true, true, undefined, false, true);
            if (mergedPiles) {
                mergedPiles.parent = mesh;
                mergedPiles.material = Pier.getPileMaterial(mergedPiles.getScene());
            }
        }

        // Add depot if requested
        if (hasDepot) {
            const depot = Decorations.getDepot();
            depot.rotation.y = -Math.PI / 2;
            // Position at the start of the pier (shore end) at -length/2
            depot.position.set(-length / 2 + 3, 1.5, 0);
            depot.parent = mesh;

            // Add CollectedBottles
            const collectedBottles = new CollectedBottles();
            // Center the collection roughly
            collectedBottles.mesh.position.set(-length / 2 + 8, 2.1, 2.0);
            collectedBottles.mesh.rotation.y = Math.PI / 2;
            collectedBottles.mesh.parent = mesh;
            this.collectedBottles = collectedBottles;
        }

        // Apply initial rotation and position
        mesh.rotation.y = -angle;
        mesh.position.set(x, 0, y);
    }

    private buildStandardPier(length: number, width: number, physicsBody: planck.Body, mesh: TransformNode, deckMeshes: Mesh[], pileMeshes: Mesh[]) {
        // Length is along X (extending from bank). Width is along Y (in world? No, width is Z in local).
        // Physics Body expects box at (0,0) with half extents.
        physicsBody.createFixture({
            shape: planck.Box(length / 2, width / 2),
            friction: 0.5
        });

        // Deck
        const deck = MeshBuilder.CreateBox("deck", { width: length, height: 0.5, depth: width });
        deck.position.y = 1.5; // Raised up
        deckMeshes.push(deck);

        // Piles
        const numPiles = Math.floor(length / 3);
        for (let i = 0; i <= numPiles; i++) {
            const xPos = -length / 2 + (length / numPiles) * i;
            pileMeshes.push(this.createPile(xPos, -width / 2));
            pileMeshes.push(this.createPile(xPos, width / 2));
        }
    }

    private createPile(x: number, z: number): Mesh {
        const pile = MeshBuilder.CreateCylinder("pile", { diameter: 0.4, height: 4.0 });
        pile.position.set(x, 0, z);
        return pile;
    }

    private buildDockedPier(length: number, width: number, physicsBody: planck.Body, mesh: TransformNode, deckMeshes: Mesh[], pileMeshes: Mesh[]) {
        // ... (truncated logic for brevity, implementing the same pattern)
        const DOCK_LENGTH = Pier.DOCK_LENGTH;
        const SENSOR_LENGTH = DOCK_LENGTH / 2.0;
        const HEAD_BACK_THICKNESS = 2.5;
        const ARM_WIDTH = 1.5;
        const NOTCH_WIDTH = Math.max(width - ARM_WIDTH, Pier.DOCK_DEPTH);
        const HEAD_WIDTH = NOTCH_WIDTH + ARM_WIDTH * 2.0;

        const tipX = length / 2;
        const startX = -length / 2;

        const armsEndX = tipX;
        const armsStartX = armsEndX - DOCK_LENGTH;
        const crossbarStartX = armsStartX - HEAD_BACK_THICKNESS;

        // 1. Base Segment
        const baseLen = crossbarStartX - startX;
        if (baseLen > 0) {
            const baseCenterX = startX + baseLen / 2;
            this.addSegment(baseCenterX, baseLen, 0, width, physicsBody, deckMeshes);
            this.addPilesForSegment(baseCenterX, baseLen, 0, width, pileMeshes);
        }

        // 2. Head Crossbar
        const crossbarCenterX = crossbarStartX + HEAD_BACK_THICKNESS / 2;
        this.addSegment(crossbarCenterX, HEAD_BACK_THICKNESS, 0, HEAD_WIDTH, physicsBody, deckMeshes);

        // 3. Head Arms
        const armsCenterX = armsStartX + DOCK_LENGTH / 2;
        const leftArmZ = (NOTCH_WIDTH + ARM_WIDTH) / 2;
        this.addSegment(armsCenterX, DOCK_LENGTH, leftArmZ, ARM_WIDTH, physicsBody, deckMeshes);
        const rightArmZ = -(NOTCH_WIDTH + ARM_WIDTH) / 2;
        this.addSegment(armsCenterX, DOCK_LENGTH, rightArmZ, ARM_WIDTH, physicsBody, deckMeshes);

        // 4. Sensor
        const sensorCenterX = armsStartX + SENSOR_LENGTH / 2;
        const sensorFixture = physicsBody.createFixture({
            shape: planck.Box(SENSOR_LENGTH / 2, NOTCH_WIDTH / 2, planck.Vec2(sensorCenterX, 0)),
            isSensor: true
        });
        sensorFixture.setUserData({ type: 'sensor' });

        // 5. Dock Sign
        const signMesh = MeshBuilder.CreateBox("sign", { width: 4.0, height: 4.0, depth: 0.1 });
        const multiMat = Pier.getSignMultiMaterial(signMesh.getScene());
        signMesh.material = Pier.getDeckMaterial(signMesh.getScene());

        const signFront = MeshBuilder.CreatePlane("signFront", { width: 4.0, height: 4.0 });
        signFront.parent = signMesh;
        signFront.position.z = 0.06;
        signFront.material = multiMat.subMaterials[4];

        const signBack = MeshBuilder.CreatePlane("signBack", { width: 4.0, height: 4.0 });
        signBack.parent = signMesh;
        signBack.position.z = -0.06;
        signBack.rotation.y = Math.PI;
        signBack.material = multiMat.subMaterials[5];

        signMesh.position.set(crossbarCenterX, 1.5 + 2.0, 0);
        signMesh.rotation.y = Math.PI / 2;
        signMesh.parent = mesh;

        // Piles for Head
        this.addPilesForSegment(crossbarCenterX, HEAD_BACK_THICKNESS, 0, HEAD_WIDTH, pileMeshes);
        this.addPilesForSegment(armsCenterX, DOCK_LENGTH, leftArmZ, ARM_WIDTH, pileMeshes);
        this.addPilesForSegment(armsCenterX, DOCK_LENGTH, rightArmZ, ARM_WIDTH, pileMeshes);
    }

    private addSegment(centerX: number, segmentLength: number, centerY: number, segmentWidth: number, physicsBody: planck.Body, deckMeshes: Mesh[]) {
        // Physics Fixture
        physicsBody.createFixture({
            shape: planck.Box(segmentLength / 2, segmentWidth / 2, planck.Vec2(centerX, centerY)),
            friction: 0.5
        });

        // Visual Mesh
        const segmentMesh = MeshBuilder.CreateBox("segment", { width: segmentLength, height: 0.5, depth: segmentWidth });
        segmentMesh.position.set(centerX, 1.5, centerY);
        deckMeshes.push(segmentMesh);
    }

    private addPilesForSegment(centerX: number, len: number, centerY: number, width: number, pileMeshes: Mesh[]) {
        const numPiles = Math.max(1, Math.floor(len / 3));
        for (let i = 0; i <= numPiles; i++) {
            const xRel = -len / 2 + (len / numPiles) * i;
            const pileX = centerX + xRel;
            const y1 = centerY - width / 2 + 0.2;
            const y2 = centerY + width / 2 - 0.2;

            pileMeshes.push(this.createPile(pileX, y1));
            pileMeshes.push(this.createPile(pileX, y2));
        }
    }

    update(dt: number) {
        this.collectedBottles?.update(dt);
    }
}
