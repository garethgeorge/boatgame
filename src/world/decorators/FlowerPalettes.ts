import * as THREE from 'three';

export interface FlowerPalette {
    colors: number[];
}

export class FlowerPalettes {
    public static readonly DAISY: FlowerPalette = {
        colors: [
            0x0000ff, // Bright Blue
            0x8a2be2, // Blue Violet
            0x800080, // Purple
            0xff00ff, // Magenta
            0xff69b4, // Hot Pink
        ]
    };

    public static readonly LILY: FlowerPalette = {
        colors: [
            0xff0000, // Red
            0xff4500, // Orange Red
            0xff8c00, // Dark Orange
            0xffa500, // Orange
            0xffff00, // Yellow
        ]
    };

    private static readonly PALETTES: Record<string, FlowerPalette> = {
        'daisy': this.DAISY,
        'lily': this.LILY,
    };

    /**
     * Returns a color interpolated from the given palette based on t (0-1).
     */
    public static getInterpolatedColor(palette: FlowerPalette, t: number): number {
        if (palette.colors.length === 0) return 0xffffff;
        if (palette.colors.length === 1) return palette.colors[0];

        const scaledT = t * (palette.colors.length - 1);
        const index = Math.floor(scaledT);
        const fraction = scaledT - index;

        if (index >= palette.colors.length - 1) {
            return palette.colors[palette.colors.length - 1];
        }

        const colorA = new THREE.Color(palette.colors[index]);
        const colorB = new THREE.Color(palette.colors[index + 1]);

        return colorA.lerp(colorB, fraction).getHex();
    }

    /**
     * Gets a palette by name. Defaults to DAISY if not found.
     */
    public static getPalette(name: string): FlowerPalette {
        return this.PALETTES[name.toLowerCase()] || this.DAISY;
    }
}
