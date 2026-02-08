import * as THREE from 'three'
import { CoreMath } from "../../core/CoreMath";
import { Combine, Signal } from "../decorators/DecorationRuleBuilders";
import { WorldContext } from "../decorators/DecorationRule";
import { Decorations, LSystemTreeKind, LSystemFlowerKind, DecorationInstance } from "./Decorations";
import { ColorPalettes } from "../decorators/ColorPalettes";
import { DecorationMetadata } from "./DecorationMetadata";
import { RiverSystem } from "../RiverSystem";
import { DecorationContext, DecorationPlacement } from '../decorators/DecorationPlacement';

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

class Details {
    public static calculateShoreRotation(worldX: number, worldZ: number) {
        const riverSystem = RiverSystem.getInstance();
        const closest = riverSystem.getClosestCenterPoint({ x: worldX, z: worldZ });

        // Vector from the point to the closest river center point
        const vx = closest.x - worldX;
        const vz = closest.z - worldZ;

        // Assumes the model faces +z
        return Math.PI / 2 - Math.atan2(vz, vx);
    }
}

export class RockPlacement extends DecorationPlacement {
    constructor(
        x: number, y: number, z: number,
        groundRadius: number,
        extraSpacing: number,
        public readonly rockBiome: string,
        public readonly scale: number,
        public readonly rotation: number
    ) {
        super(x, y, z, groundRadius, 0, extraSpacing);
    }

    public override get kind() { return 'rock'; }

    public override *ensureLoaded() {
        yield* Decorations.ensureAllLoaded(['rock']);
    }

    public override place(ctx: DecorationContext) {
        const rockInstances = Decorations.getRockInstance(this.rockBiome, this.scale);
        ctx.tryPlaceInstances(rockInstances, this.kind, this.x, this.y, this.z, this.scale, this.rotation);
    }
}

export class TreePlacement extends DecorationPlacement {
    constructor(
        x: number, y: number, z: number,
        groundRadius: number,
        canopyRadius: number,
        extraSpacing: number,
        public readonly treeKind: LSystemTreeKind,
        public readonly scale: number,
        public readonly rotation: number,
        public readonly color?: number,
        public readonly woodColor?: number,
        public readonly isSnowy?: boolean,
        public readonly isLeafLess?: boolean
    ) {
        super(x, y, z, groundRadius, canopyRadius, extraSpacing);
    }

    public override get kind() { return this.treeKind; }

    public override *ensureLoaded() {
        yield* Decorations.ensureAllLoaded(['lsystem-tree']);
    }

    public override place(ctx: DecorationContext) {
        const treeInstances = Decorations.getLSystemTreeInstance({
            kind: this.treeKind,
            leafColor: this.color,
            woodColor: this.woodColor,
            isSnowy: this.isSnowy,
            isLeafLess: this.isLeafLess
        });
        ctx.tryPlaceInstances(treeInstances, this.kind, this.x, this.y, this.z, this.scale, this.rotation);
    }
}

export class FlowerPlacement extends DecorationPlacement {
    constructor(
        x: number, y: number, z: number,
        groundRadius: number,
        extraSpacing: number,
        public readonly flowerKind: LSystemFlowerKind,
        public readonly scale: number,
        public readonly rotation: number,
        public readonly color?: number
    ) {
        super(x, y, z, groundRadius, 0, extraSpacing);
    }

    public override get kind() { return this.flowerKind; }

    public override *ensureLoaded() {
        yield* Decorations.ensureAllLoaded(['lsystem-flower']);
    }

    public override place(ctx: DecorationContext) {
        const flowerInstances = Decorations.getLSystemFlowerInstance({
            kind: this.flowerKind,
            petalColor: this.color ?? 0xffffff
        });
        ctx.tryPlaceInstances(flowerInstances, this.kind, this.x, this.y, this.z, this.scale, this.rotation);
    }
}

export class PlantPlacement extends DecorationPlacement {
    constructor(
        x: number, y: number, z: number,
        groundRadius: number,
        canopyRadius: number,
        extraSpacing: number,
        public readonly plantKind: string,
        public readonly scale: number,
        public readonly rotation: number
    ) {
        super(x, y, z, groundRadius, canopyRadius, extraSpacing);
    }

    public override get kind() { return this.plantKind; }

    public override *ensureLoaded() {
        yield* Decorations.ensureAllLoaded([this.plantKind as any]);
    }

    public override place(ctx: DecorationContext) {
        let instances: DecorationInstance[];
        switch (this.plantKind) {
            case 'cactus': instances = Decorations.getCactusInstance(); break;
            case 'cycad': instances = Decorations.getCycadInstance(); break;
            case 'treeFern': instances = Decorations.getTreeFernInstance(); break;
            default: return;
        }
        ctx.tryPlaceInstances(instances, this.kind, this.x, this.y, this.z, this.scale, this.rotation);
    }
}

export class MangrovePlacement extends DecorationPlacement {
    constructor(
        x: number, y: number, z: number,
        groundRadius: number,
        canopyRadius: number,
        public readonly scale: number,
        public readonly rotation: number
    ) {
        super(x, y, z, groundRadius, canopyRadius, 0);
    }

    public override get kind() { return 'mangrove'; }

    public override *ensureLoaded() {
        yield* Decorations.ensureAllLoaded(['mangrove']);
    }

    public override place(ctx: DecorationContext) {
        const mangrove = Decorations.getMangrove(this.scale);
        ctx.tryPlaceObject(mangrove, this.kind, this.x, this.y, this.z, this.scale, this.rotation);
    }
}

export class PropPlacement extends DecorationPlacement {
    constructor(
        x: number, y: number, z: number,
        groundRadius: number,
        canopyRadius: number,
        public readonly propKind: string,
        public readonly scale: number,
        public rotation: number,
        public readonly placeTowardShore: boolean = false
    ) {
        super(x, y, z, groundRadius, canopyRadius, 0);
    }

    public override get kind() { return this.propKind; }

    public override *ensureLoaded() {
        yield* Decorations.ensureAllLoaded([this.propKind as any]);
    }

    public override place(ctx: DecorationContext) {
        if (this.placeTowardShore) {
            this.rotation = Details.calculateShoreRotation(this.x, this.z);
        }

        let model: THREE.Object3D | undefined;
        switch (this.propKind) {
            case 'beachChair': model = Decorations.getBeachChair()?.model; break;
            case 'beachUmbrella': model = Decorations.getBeachUmbrella()?.model; break;
        }
        if (model) ctx.tryPlaceObject(model, this.kind, this.x, this.y, this.z, this.scale, this.rotation);
    }
}

export class UmbrellaWithChairsPlacement extends DecorationPlacement {
    constructor(
        x: number, y: number, z: number,
        groundRadius: number,
        public readonly numChairs: number,
        public readonly scale: number
    ) {
        super(x, y, z, groundRadius, 0, 0);
    }

    public override get kind() { return 'umbrellaWithChairs'; }

    public override *ensureLoaded() {
        yield* Decorations.ensureAllLoaded(['beachUmbrella', 'beachChair']);
    }

    public override place(ctx: DecorationContext) {
        // 1. Place Umbrella at center
        const umbrellaModel = Decorations.getBeachUmbrella()?.model;
        if (umbrellaModel) {
            const umbrellaScale = this.scale * 1.5;
            const umbrellaRot = Math.random() * Math.PI * 2;
            ctx.tryPlaceObject(umbrellaModel, 'beachUmbrella', this.x, this.y, this.z, umbrellaScale, umbrellaRot);
        }

        // 2. Calculate shore rotation for chairs
        const shoreRot = Details.calculateShoreRotation(this.x, this.z);

        // 3. Determine chair positions
        const chairModel = Decorations.getBeachChair()?.model;
        if (chairModel) {
            const chairScale = this.scale;
            const chairRadius = DecorationMetadata.beachChair.groundRadius;
            const offsetDist = chairRadius * chairScale;

            const dx = Math.cos(shoreRot) * offsetDist;
            const dz = -Math.sin(shoreRot) * offsetDist;

            const placeChair = (isLeft: boolean) => {
                const side = isLeft ? -1 : 1;
                const x = this.x + dx * side;
                const z = this.z + dz * side;
                const y = this.y;
                ctx.tryPlaceObject(chairModel, 'beachChair', x, y, z, chairScale, shoreRot);
            }

            if (this.numChairs === 1) {
                placeChair(Math.random() > 0.5);
            } else if (this.numChairs >= 2) {
                placeChair(true);
                placeChair(false);
            }
        }
    }
}

export class RockParams {
    public static rock(options: { rockBiome?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.8;
            const groundRadius = DecorationMetadata.rock.groundRadius * scale;
            const spacing = 10.0;
            return new RockPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                groundRadius,
                spacing,
                options.rockBiome ?? 'happy',
                scale,
                ctx.random() * Math.PI * 2
            );
        };
    }
}

export class TreeParams {
    public static elder(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 2.0 + ctx.random() * 0.5; // Large scale
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.elder;
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                25.0,
                'elder' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
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
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                spacing ?? 0,
                'birch' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
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
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                0,
                'oak' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color,
                undefined,
                snow,
                ctx.random() > leaves
            );
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
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                spacing,
                'elm' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color,
                woodColor,
                snow,
                ctx.random() > leaves
            );
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
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                0,
                'vase' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
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
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                spacing,
                'willow' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color,
                woodColor
            );
        };
    }

    public static poplar(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.7 + ctx.random() * 0.6;
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.poplar;
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                2,
                'poplar' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
        };
    }

    public static japanese_maple(options: { paletteName?: string } = {}) {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.6;
            const color = options.paletteName ? ColorPalettes.getInterpolatedColor(ColorPalettes.getPalette(options.paletteName), ctx.random()) : undefined;
            const meta = DecorationMetadata.open;
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                0,
                'open' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
        };
    }

    public static palm() {
        return (ctx: WorldContext) => {
            const scale = 1.5 + ctx.random() * 1.0;
            const meta = DecorationMetadata.palm;
            return new TreePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                0,
                'palm' as LSystemTreeKind,
                scale,
                ctx.random() * Math.PI * 2
            );
        };
    }
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
            return new FlowerPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale * pack,
                spacing,
                'daisy' as LSystemFlowerKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
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
            return new FlowerPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale * pack,
                spacing,
                'lily' as LSystemFlowerKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
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
            return new FlowerPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale * pack,
                spacing,
                'waterlily' as LSystemFlowerKind,
                scale,
                ctx.random() * Math.PI * 2,
                color
            );
        };
    }
}

export class PlantParams {
    public static cactus() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.cactus;
            return new PlantPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                1,
                'cactus',
                scale,
                ctx.random() * Math.PI * 2
            );
        };
    }

    public static cycad() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.cycad;
            return new PlantPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                1,
                'cycad',
                scale,
                ctx.random() * Math.PI * 2
            );
        };
    }

    public static tree_fern() {
        return (ctx: WorldContext) => {
            const scale = 0.8 + ctx.random() * 0.4;
            const meta = DecorationMetadata.treeFern;
            return new PlantPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                1,
                'treeFern',
                scale,
                ctx.random() * Math.PI * 2
            );
        };
    }
}

export class MangroveParams {
    public static mangrove() {
        return (ctx: WorldContext) => {
            const scale = 1.5 + ctx.random() * 0.5;
            const meta = DecorationMetadata.mangrove;
            return new MangrovePlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                scale,
                ctx.random() * Math.PI * 2
            );
        }
    }
}

export class PropParams {
    public static beach_chair() {
        return (ctx: WorldContext) => {
            const scale = 3.0;
            const meta = DecorationMetadata.beachChair;
            return new PropPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                'beachChair',
                scale,
                0,
                true // placeTowardShore
            );
        };
    }

    public static beach_umbrella() {
        return (ctx: WorldContext) => {
            const scale = 1.0;
            const meta = DecorationMetadata.beachUmbrella;
            return new PropPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                meta.groundRadius * scale,
                meta.canopyRadius * scale,
                'beachUmbrella',
                scale,
                ctx.random() * Math.PI * 2
            );
        };
    }

    public static umbrella_with_chairs(numChairs: number) {
        return (ctx: WorldContext) => {
            const scale = 3.0;
            const chairRadius = DecorationMetadata.beachChair.groundRadius;
            return new UmbrellaWithChairsPlacement(
                ctx.pos.x, ctx.elevation, ctx.pos.y,
                2 * chairRadius * scale,
                numChairs,
                scale
            );
        };
    }
}
