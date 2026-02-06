import { Decorations } from './Decorations';
import { DecorationRegistry } from './DecorationRegistry';
import { ARCHETYPES as TREE_ARCHETYPES, LSystemTreeKind } from '../factories/LSystemTreeArchetypes';
import { ARCHETYPES as FLOWER_ARCHETYPES, LSystemFlowerKind } from '../factories/LSystemFlowerArchetypes';

export interface DecorationManifestEntry {
    name: string;
    model: () => any;
    hasCanopy: boolean;
}

const tree = (kind: LSystemTreeKind) => {
    return () => Decorations.getLSystemTreeInstance({ kind });
};

const flower = (kind: LSystemFlowerKind) => {
    return () => Decorations.getLSystemFlowerInstance({ kind });
};

export const DECORATION_MANIFEST: DecorationManifestEntry[] = [
    { name: 'rock', model: () => DecorationRegistry.getFactory('rock').create(), hasCanopy: false },
    { name: 'cactus', model: () => DecorationRegistry.getFactory('cactus').create(), hasCanopy: false },
    { name: 'bush', model: () => DecorationRegistry.getFactory('bush').create(), hasCanopy: false },
    ...Object.keys(TREE_ARCHETYPES).map(kind => ({
        name: kind,
        model: tree(kind as LSystemTreeKind),
        hasCanopy: true
    })),
    ...Object.keys(FLOWER_ARCHETYPES).map(kind => ({
        name: kind,
        model: flower(kind as LSystemFlowerKind),
        hasCanopy: false
    })),
    { name: 'cycad', model: () => DecorationRegistry.getFactory('cycad').create(), hasCanopy: true },
    { name: 'treeFern', model: () => DecorationRegistry.getFactory('treeFern').create(), hasCanopy: true },
    { name: 'mangrove', model: () => Decorations.getMangrove(), hasCanopy: true }
];
