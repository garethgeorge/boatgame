import * as THREE from 'three'
import { CoreMath } from "../../core/CoreMath";
import { Combine, Signal } from "../decorators/PoissonDecorationRules";
import { WorldContext } from "../decorators/PoissonDecorationStrategy";
import { ColorPalettes } from "../decorators/ColorPalettes";
import { DecorationMetadata } from "./DecorationMetadata";
import { DecorationContext, DecorationOptions } from "../decorators/TerrainDecorator";
import { Decorations, LSystemTreeKind, LSystemFlowerKind, DecorationInstance } from "./Decorations";
import { RiverSystem } from "../RiverSystem";

/** 
 * Parameters for building a fitness function that is the product
 * of the parameters.
 */
export interface FitnessParams {
    // overall fitness multiplier
    fitness?: number,
    // min fitness value regardless of other factors
    minFitness?: number,

    // River distance parameters
    // 0 up to first value, reaches 1 at second
    linearEaseIn?: [number, number],
    // 1 up to first value, reaches 0 at second
    linearEaseOut?: [number, number],
    // 0 outside the range, 1 inside
    stepDistance?: [number, number],

    // Samples 2D noise and returns 1 if value exceeds threshold
    stepNoise?: {
        scale: number | [number, number],
        threshold: number
    },

    // 1 if the named map value is in range
    map?: { name: string, range: [number, number] },

    // Elevation must be between these values
    elevation?: [number, number],

    // Slope must be between these values
    slope?: [number, number]
}

export class Fitness {

    public static make(params: FitnessParams) {

        let fitnessFuncs: ((ctx: WorldContext) => number)[] = [];

        fitnessFuncs.push(Signal.constant(params.fitness ?? 1.0));

        if (params.stepDistance !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.distanceToRiver,
                params.stepDistance[0], params.stepDistance[1]
            ));
        }
        if (params.linearEaseIn !== undefined) {
            fitnessFuncs.push(Signal.linearEaseIn(Signal.distanceToRiver,
                params.linearEaseIn[0], params.linearEaseIn[1]
            ))
        }
        if (params.linearEaseOut !== undefined) {
            fitnessFuncs.push(Signal.linearEaseOut(Signal.distanceToRiver,
                params.linearEaseOut[0], params.linearEaseOut[1]
            ))
        }
        if (params.stepNoise !== undefined) {
            const scale = params.stepNoise.scale;
            const sx = Array.isArray(scale) ? scale[0] : scale;
            const sy = Array.isArray(scale) ? scale[1] : scale;
            const dx = Math.random();
            const dy = Math.random();
            const threshold = params.stepNoise.threshold;
            fitnessFuncs.push(Signal.step(
                Signal.noise2D(sx, sy, dx, dy),
                threshold));
        }
        if (params.map !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.map(params.map.name),
                params.map.range[0], params.map.range[1]));
        }
        if (params.elevation !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.elevation,
                params.elevation[0], params.elevation[1]));
        }
        if (params.slope !== undefined) {
            fitnessFuncs.push(Signal.inRange(Signal.slope,
                params.slope[0], params.slope[1]));
        }

        if (params.minFitness !== undefined) {
            fitnessFuncs = [
                Signal.max(
                    Signal.constant(params.minFitness),
                    Combine.all(...fitnessFuncs))
            ];
        }

        return fitnessFuncs.length === 1 ?
            fitnessFuncs[0] : Combine.all(...fitnessFuncs);
    }
}

export interface CommonDecorationOptions extends DecorationOptions {
    scale: number;
    rotation: number;
}

export interface RockDecorationOptions extends CommonDecorationOptions {
    rockBiome?: string;
}

export class RockParams {
    public static rock(options: { rockBiome?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.8;
            return {
                groundRadius: DecorationMetadata.rock.groundRadius * scale,
                spacing: 10.0,
                options: {
                    place: RockParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['rock']),
                    kind: 'rock',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    rockBiome: options.rockBiome
                }
            };
        };
    }

    public static place = (
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) => {
        const opts = options as RockDecorationOptions;
        const rockInstances = Decorations.getRockInstance(opts.rockBiome ?? 'happy', opts.scale);
        ctx.tryPlaceInstances(rockInstances, opts.kind, pos, opts.scale, opts.rotation);
    }
}

export interface TreeDecorationOptions extends CommonDecorationOptions {
    color?: number;
    woodColor?: number;
    isSnowy?: boolean;
    isLeafLess?: boolean;
}

export class TreeParams {
    public static elder(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 2.0 + ctx.random() * 0.5; // Large scale
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.elder;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 25.0,
                options: { place: TreeParams.place, ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']), kind: 'elder', rotation: ctx.random() * Math.PI * 2, scale, color } as TreeDecorationOptions
            };
        }
    }

    public static birch(options: {
        spacing?: number,
        paletteName?: string
    } = {}) {
        const {
            spacing = undefined,
            paletteName = undefined
        } = options;
        return (ctx: WorldContext) => {
            const scale = CoreMath.clamp(0.6, 1.8, 0.9 + ctx.gaussian() * 0.3);
            const color = paletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) :
                undefined;
            const meta = DecorationMetadata.birch;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: spacing,
                options: { place: TreeParams.place, ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']), kind: 'birch', rotation: ctx.random() * Math.PI * 2, scale, color } as TreeDecorationOptions
            };
        };
    }

    public static oak(options: { paletteName?: string, snow?: boolean, leaves?: number } = {}) {
        const {
            paletteName = undefined,
            snow = false,
            leaves = 1
        } = options;
        return (ctx: WorldContext) => {
            const scale = CoreMath.clamp(0.8, 3.0, 1.0 + ctx.gaussian() * 0.5);
            const color = paletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) :
                undefined;
            const meta = DecorationMetadata.oak;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: {
                    place: TreeParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']),
                    kind: 'oak',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    color,
                    isSnowy: snow,
                    isLeafLess: ctx.random() > leaves
                } as TreeDecorationOptions
            };
        };
    }

    public static elm(options: {
        size?: number,
        spacing?: number,
        paletteName?: string,
        woodPaletteName?: string,
        snow?: boolean,
        leaves?: number
    } = {}) {
        const {
            size = 1,
            spacing = 15,
            paletteName = undefined,
            woodPaletteName = undefined,
            snow = false,
            leaves = 1
        } = options;
        return (ctx: WorldContext) => {
            const scale = size * (1.0 + ctx.random() * 0.5);
            const color = paletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) :
                undefined;
            const woodColor = woodPaletteName !== undefined ?
                ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(woodPaletteName), ctx.random()) :
                undefined;
            const meta = DecorationMetadata.elm;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: spacing,
                options: {
                    place: TreeParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']),
                    kind: 'elm',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    color,
                    woodColor,
                    isSnowy: snow,
                    isLeafLess: ctx.random() > leaves
                } as TreeDecorationOptions
            };
        };
    }

    public static box_elder(options: {
        size?: number,
        paletteName?: string
    } = {}) {
        const {
            size = 1,
            paletteName = undefined
        } = options;
        return (ctx: WorldContext) => {
            const scale = size * 0.9 + ctx.random() * 0.4;
            const color = paletteName !== undefined ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.vase;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: { place: TreeParams.place, ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']), kind: 'vase', rotation: ctx.random() * Math.PI * 2, scale, color } as TreeDecorationOptions
            };
        };
    }

    public static willow(options: {
        spacing?: number,
        paletteName?: string,
        woodPaletteName?: string
    } = {}) {
        const {
            spacing = 0,
            paletteName = undefined,
            woodPaletteName = undefined
        } = options;
        return (ctx: WorldContext) => {
            const scale = 2.0 + ctx.random() * 1.0;
            const color = paletteName !== undefined ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(paletteName), ctx.random()) : undefined;
            const woodColor = woodPaletteName !== undefined ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(woodPaletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.willow;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: spacing,
                options: { place: TreeParams.place, ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']), kind: 'willow', rotation: ctx.random() * Math.PI * 2, scale, color, woodColor } as TreeDecorationOptions
            };
        };
    }

    public static poplar(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.6;
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.poplar;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 2,
                options: { place: TreeParams.place, ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']), kind: 'poplar', rotation: ctx.random() * Math.PI * 2, scale, color } as TreeDecorationOptions
            }
        };
    }

    public static japanese_maple(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.6;
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.open;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: { place: TreeParams.place, ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']), kind: 'open', rotation: ctx.random() * Math.PI * 2, scale, color } as TreeDecorationOptions
            };
        };
    }

    public static palm() {
        return (ctx: WorldContext) => {
            const scale = 1.5 + ctx.random() * 1.0;
            const meta = DecorationMetadata.palm;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: {
                    place: TreeParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-tree']),
                    kind: 'palm',
                    rotation: ctx.random() * Math.PI * 2,
                    scale
                } as TreeDecorationOptions
            };
        };
    }

    public static place = (
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) => {
        const opts = options as TreeDecorationOptions;
        const treeInstances = Decorations.getLSystemTreeInstance({
            kind: options.kind as LSystemTreeKind,
            leafColor: opts.color,
            woodColor: opts.woodColor,
            isSnowy: opts.isSnowy,
            isLeafLess: opts.isLeafLess
        });
        ctx.tryPlaceInstances(treeInstances, opts.kind, pos, opts.scale, opts.rotation);
    }
}

export interface FlowerDecorationOptions extends CommonDecorationOptions {
    color?: number;
}

export class FlowerParams {
    public static daisy(options: {
        pack?: number,
        spacing?: number,
        paletteName?: string
    } = {}) {
        const {
            pack = 1,
            spacing = 2,
            paletteName = 'daisy'
        } = options;
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.5;
            const palette = ColorPalettes.getPalette(paletteName);
            const color = ColorPalettes.getInterpolatedColor(palette, ctx.random());
            const meta = DecorationMetadata.daisy;
            return {
                groundRadius: meta.groundRadius * scale * pack,
                spacing: spacing,
                options: {
                    place: FlowerParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-flower']),
                    kind: 'daisy',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    color
                } as FlowerDecorationOptions
            };
        };
    }

    public static lily(options: {
        pack?: number,
        spacing?: number,
        paletteName?: string
    } = {}) {
        const {
            pack = 1,
            spacing = 2,
            paletteName = 'lily'
        } = options;
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.5;
            const palette = ColorPalettes.getPalette(paletteName);
            const color = ColorPalettes.getInterpolatedColor(palette, ctx.random());
            const meta = DecorationMetadata.lily;
            return {
                groundRadius: meta.groundRadius * scale * pack,
                spacing: spacing,
                options: {
                    place: FlowerParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-flower']),
                    kind: 'lily',
                    rotation: ctx.random() * Math.PI * 2,
                    scale,
                    color
                } as FlowerDecorationOptions
            };
        };
    }

    public static waterlily(options: {
        pack?: number,
        spacing?: number,
        paletteName?: string
    } = {}) {
        const {
            pack = 1,
            spacing = 2,
            paletteName = 'lily'
        } = options;
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.5;
            const palette = ColorPalettes.getPalette(paletteName);
            const color = ColorPalettes.getInterpolatedColor(palette, ctx.random());
            const meta = DecorationMetadata.lily; // Assuming waterlily uses similar metadata
            return {
                groundRadius: meta.groundRadius * scale * pack,
                spacing: spacing,
                options: {
                    place: FlowerParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['lsystem-flower']),
                    kind: 'waterlily',
                    rotation: ctx.random() * Math.PI * 2,
                    scale, color
                } as FlowerDecorationOptions
            };
        };
    }

    public static place = (
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) => {
        const opts = options as FlowerDecorationOptions;
        const flowerInstances = Decorations.getLSystemFlowerInstance({
            kind: options.kind as LSystemFlowerKind,
            petalColor: opts.color ?? 0xffffff
        });
        ctx.tryPlaceInstances(flowerInstances, opts.kind, pos, opts.scale, opts.rotation);
    }
}

export class PlantParams {
    public static cactus() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.cactus;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 1,
                options: {
                    place: PlantParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['cactus']),
                    kind: 'cactus',
                    rotation: ctx.random() * Math.PI * 2,
                    scale
                }
            };
        };
    }

    public static cycad() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.cycad;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 1,
                options: {
                    place: PlantParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['cycad']),
                    kind: 'cycad',
                    rotation: ctx.random() * Math.PI * 2,
                    scale
                }
            };
        };
    }

    public static tree_fern() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.treeFern;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                spacing: 1,
                options: {
                    place: PlantParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['treeFern']),
                    kind: 'treeFern',
                    rotation: ctx.random() * Math.PI * 2,
                    scale
                }
            };
        };
    }

    public static place = (
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) => {
        const opts = options as CommonDecorationOptions;
        let instances: DecorationInstance[];
        switch (options.kind) {
            case 'cactus': instances = Decorations.getCactusInstance(); break;
            case 'cycad': instances = Decorations.getCycadInstance(); break;
            case 'treeFern': instances = Decorations.getTreeFernInstance(); break;
            default: return;
        }
        ctx.tryPlaceInstances(instances, opts.kind, pos, opts.scale, opts.rotation);
    }
}

export class MangroveParams {
    public static mangrove() {
        return (ctx: WorldContext) => {
            const scale = 1.5 + ctx.random() * 0.5;
            const meta = DecorationMetadata.mangrove;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: {
                    place: MangroveParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['mangrove']),
                    kind: 'mangrove',
                    rotation: ctx.random() * Math.PI * 2,
                    scale
                }
            };
        }
    }

    public static place = (
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) => {
        const opts = options as CommonDecorationOptions;
        const mangrove = Decorations.getMangrove(opts.scale);
        ctx.tryPlaceObject(mangrove, opts.kind, pos, opts.scale, opts.rotation);
    }
}

export interface UmbrellaWithChairsOptions extends CommonDecorationOptions {
    numChairs: number;
}

export class PropParams {
    public static beach_chair() {
        return (ctx: WorldContext) => {
            const scale = 3.0;
            const meta = DecorationMetadata.beachChair;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: {
                    place: PropParams.place_toward_shore,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['beachChair']),
                    kind: 'beachChair',
                    rotation: 0,    // calculated when placing
                    scale
                }
            };
        };
    }

    public static beach_umbrella() {
        return (ctx: WorldContext) => {
            const scale = 1.0;
            const meta = DecorationMetadata.beachUmbrella;
            return {
                groundRadius: meta.groundRadius * scale,
                canopyRadius: meta.canopyRadius * scale,
                options: {
                    place: PropParams.place,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['beachUmbrella']),
                    kind: 'beachUmbrella',
                    rotation: ctx.random() * Math.PI * 2,
                    scale
                }
            };
        };
    }

    public static umbrella_with_chairs(numChairs: number) {
        return (ctx: WorldContext) => {
            const scale = 3.0;
            const chairRadius = DecorationMetadata.beachChair.groundRadius;
            return {
                groundRadius: 2 * chairRadius * scale,
                options: {
                    place: PropParams.place_umbrella_with_chairs,
                    ensureLoaded: () => Decorations.ensureAllLoaded(['beachUmbrella', 'beachChair']),
                    kind: 'umbrellaWithChairs',
                    numChairs,
                    scale,
                    rotation: 0
                } as UmbrellaWithChairsOptions
            };
        };
    }

    public static place(
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) {
        const opts = options as CommonDecorationOptions;
        let model: THREE.Object3D | undefined;
        switch (options.kind) {
            case 'beachChair': model = Decorations.getBeachChair()?.model; break;
            case 'beachUmbrella': model = Decorations.getBeachUmbrella()?.model; break;
        }
        if (model) ctx.tryPlaceObject(model, opts.kind, pos, opts.scale, opts.rotation);
    }

    public static place_toward_shore(
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) {
        const opts = options as CommonDecorationOptions;
        const rotation = PropParams.calculateShoreRotation(pos);

        let model: THREE.Object3D | undefined;
        switch (options.kind) {
            case 'beachChair': model = Decorations.getBeachChair()?.model; break;
            case 'beachUmbrella': model = Decorations.getBeachUmbrella()?.model; break;
        }
        if (model) ctx.tryPlaceObject(model, opts.kind, pos, opts.scale, rotation);
    }

    public static place_umbrella_with_chairs(
        ctx: DecorationContext,
        pos: { worldX: number, worldZ: number, height: number },
        options: DecorationOptions) {
        const opts = options as UmbrellaWithChairsOptions;

        // 1. Place Umbrella at center
        const umbrellaModel = Decorations.getBeachUmbrella()?.model;
        if (umbrellaModel) {
            // Umbrella rotation can be random
            const umbrellaScale = opts.scale * 1.5;
            const umbrellaRot = Math.random() * Math.PI * 2;
            ctx.tryPlaceObject(umbrellaModel, 'beachUmbrella', pos, umbrellaScale, umbrellaRot);
        }

        // 2. Calculate shore rotation for chairs
        const shoreRot = PropParams.calculateShoreRotation(pos);

        // 3. Determine chair positions
        const chairModel = Decorations.getBeachChair()?.model;
        if (chairModel) {
            const chairScale = opts.scale;
            const chairRadius = DecorationMetadata.beachChair.groundRadius;
            const offsetDist = chairRadius * chairScale;

            const dx = Math.cos(shoreRot) * offsetDist;
            const dz = -Math.sin(shoreRot) * offsetDist;

            const placeChair = (isLeft: boolean) => {
                const side = isLeft ? -1 : 1;
                const chairPos = {
                    worldX: pos.worldX + dx * side,
                    worldZ: pos.worldZ + dz * side,
                    height: pos.height
                };
                ctx.tryPlaceObject(chairModel, 'beachChair', chairPos, chairScale, shoreRot);
            }

            if (opts.numChairs === 1) {
                placeChair(Math.random() > 0.5);
            } else if (opts.numChairs >= 2) {
                placeChair(true);
                placeChair(false);
            }
        }
    }

    public static calculateShoreRotation(pos: { worldX: number, worldZ: number }) {
        const riverSystem = RiverSystem.getInstance();
        const closest = riverSystem.getClosestCenterPoint({ x: pos.worldX, z: pos.worldZ });

        // Vector from the point to the closest river center point
        const vx = closest.x - pos.worldX;
        const vz = closest.z - pos.worldZ;

        // Assumes the model faces +z
        return Math.PI / 2 - Math.atan2(vz, vx);
    }
}
