import { AnimalBehaviorConfig } from "../../../entities/behaviors/AnimalBehaviorConfigs";
import { EntityIds } from "../../../entities/EntityIds";
import { AnimalSpawnOptions } from "../../../entities/spawners/AnimalSpawner";
import { BoatPathLayoutConfig } from "./BoatPathLayoutStrategy";

export type Habitat = 'land' | 'water' | 'any';

/**
 * EntityGeneratorFn is called with context to generate a set of placement
 * options.
 */
export interface EntityGeneratorContext {
    config: BoatPathLayoutConfig;
};

export type EntityGeneratorFn = (ctx: EntityGeneratorContext) =>
    EntityPlacementOptions;

/**
 * Placement options describe a candidate entity placement.
 */
export interface EntityPlacementOptions {
    type: EntityIds;
    habitat: Habitat
};

export interface AnimalPlacementOptions extends EntityPlacementOptions {
    options?: (habitat: Habitat) => AnimalSpawnOptions;
};

/**
 * Details for placing a single obstacle instance along the boat path.
 */
export interface EntityPlacement {
    /** Index + fractional offset in the path array */
    index: number;
    /** Allowed distance range [-bankDist, bankDist] along the normal vector */
    range: [number, number];
    /** Optional behavior scaling for attack animals */
    aggressiveness?: number;
    entity: EntityPlacementOptions
}

export class EntityRules {
    public static choose(types: EntityGeneratorFn[]) {
        return (ctx: EntityGeneratorContext) => {
            const type = types[Math.floor(Math.random() * types.length)];
            return type(ctx);
        }
    }

    public static bottle() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.BOTTLE, habitat: 'water',
            };
        }
    }

    public static rock() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.ROCK, habitat: 'water',
            };
        }
    }

    public static log() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.LOG, habitat: 'water',
            };
        }
    }

    public static buoy() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.BUOY, habitat: 'water',
            };
        }
    }

    public static pier() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.PIER, habitat: 'water',
            };
        }
    }

    public static alligator() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.ALLIGATOR, habitat: 'any',
                options: this.behavior_wait_attack
            };
        }
    }

    public static swamp_gator() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.ALLIGATOR, habitat: 'water',
                options: (habitat: Habitat) => {
                    return {
                        distanceRange: [-10, 10],
                        behavior: {
                            type: 'attack',
                            logicName: 'AmbushAttack'
                        }
                    }
                }
            };
        }
    }

    public static hippo() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.HIPPO, habitat: 'water',
                options: this.behavior_wait_attack
            };
        }
    }

    public static swan() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.SWAN, habitat: 'water',
            };
        }
    }

    public static unicorn() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.UNICORN, habitat: 'land',
            };
        }
    }

    public static bluebird() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.BLUEBIRD, habitat: 'land',
            };
        }
    }

    public static brown_bear() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.BROWN_BEAR, habitat: 'any',
            };
        }
    }

    public static moose() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.MOOSE, habitat: 'any',
            };
        }
    }

    public static duckling() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.DUCKLING, habitat: 'water',
            };
        }
    }

    public static water_grass() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.WATER_GRASS, habitat: 'water',
            };
        }
    }

    public static dragonfly() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.DRAGONFLY, habitat: 'water',
            };
        }
    }

    public static trex() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.TREX, habitat: 'any',
            };
        }
    }

    public static triceratops() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.TRICERATOPS, habitat: 'any',
            };
        }
    }

    public static brontosaurus() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.BRONTOSAURUS, habitat: 'any',
            };
        }
    }

    public static pterodactyl() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.PTERODACTYL, habitat: 'any',
            };
        }
    }

    public static mangrove() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.MANGROVE, habitat: 'water',
            };
        }
    }

    public static snake() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.SNAKE, habitat: 'water',
            };
        }
    }

    public static egret() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.EGRET, habitat: 'water',
            };
        }
    }

    public static lily_pad_patch() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.LILLY_PAD_PATCH, habitat: 'water',
            };
        }
    }

    public static dolphin() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.DOLPHIN, habitat: 'water',
            };
        }
    }

    public static turtle() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.TURTLE, habitat: 'any',
            };
        }
    }

    public static butterfly() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.BUTTERFLY, habitat: 'land',
            };
        }
    }

    public static gingerman() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.GINGERMAN, habitat: 'any',
            }
        }
    }

    public static monkey() {
        return (ctx: EntityGeneratorContext): AnimalPlacementOptions => {
            return {
                type: EntityIds.MONKEY, habitat: 'any',
                options: this.behavior_walk_attack
            }
        }
    }

    private static behavior_wait_attack(habitat: Habitat): AnimalSpawnOptions {
        if (habitat === 'water') {
            return {
                behavior: {
                    type: 'attack',
                    logicName: Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack'
                }
            }
        } else {
            return {
                behavior: {
                    type: 'wait-attack',
                    logicName: Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack'
                }
            }
        }
    }

    private static behavior_walk_attack(habitat: Habitat): AnimalSpawnOptions {
        if (habitat === 'water') {
            return {
                behavior: {
                    type: 'attack',
                    logicName: Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack'
                }
            }
        } else {
            return {
                behavior: {
                    type: 'walk-attack',
                    logicName: Math.random() < 0.5 ? 'WolfAttack' : 'AmbushAttack'
                }
            }
        }
    }
}
