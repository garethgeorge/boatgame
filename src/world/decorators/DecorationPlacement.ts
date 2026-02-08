import * as THREE from 'three'
import { DecorationInstance } from '../factories/DecorationFactory';
import { PlacementManifest } from '../../core/SpatialGrid';

export interface DecorationContext {
    tryPlaceInstances(
        instances: DecorationInstance[],
        kind: string,
        x: number, y: number, z: number,
        scale: number, rotation: number
    );

    tryPlaceObject(
        object: THREE.Object3D,
        kind: string,
        x: number, y: number, z: number,
        scale: number, rotation: number
    );

    registerSlot(type: string, x: number, y: number, z: number): void;
}

/**
 * Decoration placement describes how to place an instance.
 */
export abstract class DecorationPlacement implements PlacementManifest {
    public readonly totalSpacing: number;

    constructor(
        public readonly x: number,
        public readonly y: number,
        public readonly z: number,
        public readonly groundRadius: number,
        public readonly canopyRadius: number = 0,
        extraSpacing: number = 0,
        public fitness: number = 1.0
    ) {
        const baseRadius = canopyRadius > 0 ? canopyRadius : groundRadius;
        this.totalSpacing = Math.max(0.01, baseRadius + extraSpacing);
    }

    public abstract get kind(): string;

    /**
     * Spawns the decoration into the world.
     */
    public abstract place(ctx: DecorationContext): void;

    /** 
     * Generator that yields promises for assets that must be loaded 
     * before this decoration can be placed.
     */
    public *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        // Default: nothing to load
    }
}
