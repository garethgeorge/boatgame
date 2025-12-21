import { TransformNode } from '@babylonjs/core';
import { TerrainChunk } from '../TerrainChunk';
import { RiverSystem } from '../RiverSystem';

export interface DecorationContext {
    // The chunk we are decorating
    chunk: TerrainChunk;
    // The river system
    riverSystem: RiverSystem;
    // Root node to attach decorations to
    root: TransformNode;
    // The z offset of the chunk
    zOffset: number;
}

export interface TerrainDecorator {
    decorate(context: DecorationContext): Promise<void>;
}
