import { SimplexNoise } from "../../core/SimplexNoise";
import { DecorationRule } from "../decorators/DecorationRule";
import { WorldMap } from "../decorators/PoissonDecorationStrategy";

export class NoiseMap implements WorldMap {
    private noise: SimplexNoise;
    private sx: number;
    private sy: number;
    private dx: number;
    private dy: number;

    constructor(noise: SimplexNoise, sx: number, sy: number,
        dx: number = Math.random(), dy: number = Math.random()) {
        this.noise = noise;
        this.sx = sx;
        this.sy = sy;
        this.dx = dx;
        this.dy = dy;
    }

    sample(x: number, y: number): number {
        return (this.noise.noise2D(x / this.sx + this.dx, y / this.sy + this.dy) + 1) / 2.0;
    }
}

export interface DecorationConfig {
    rules: DecorationRule[]
};
