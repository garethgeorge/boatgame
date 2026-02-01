import * as THREE from 'three';

export interface ColorPalette {
    colors: number[];
}

export class ColorPalettes {
    public static readonly DAISY: ColorPalette = {
        colors: [
            0x0000ff, // Bright Blue
            0x8a2be2, // Blue Violet
            0x800080, // Purple
            0xff00ff, // Magenta
            0xff69b4, // Hot Pink
        ]
    };

    public static readonly LILY: ColorPalette = {
        colors: [
            0xff0000, // Red
            0xff4500, // Orange Red
            0xff8c00, // Dark Orange
            0xffa500, // Orange
            0xffff00, // Yellow
        ]
    };

    public static readonly FALL_YELLOW: ColorPalette = {
        colors: [
            0xDEB887, // Burlywood
            0xF4A460, // Sandy Brown
            0xDAA520, // Goldenrod
            0xFFD700, // Gold
            0xFFFF00, // Yellow
        ]
    };

    public static readonly FALL_RED_ORANGE: ColorPalette = {
        colors: [
            0x8B0000, // Dark Red
            0xA52A2A, // Brown
            0xD2691E, // Chocolate
            0xE9967A, // Dark Salmon
            0xFF4500, // Orange Red
            0xFF8C00, // Dark Orange
        ]
    };

    public static readonly FANTASY_LEAVES: ColorPalette = {
        colors: [
            0x4949c0, // #4949c0
            0x6fffb7, // #6fffb7
            0xff6078, // #ff6078
            0x4d9fbb, // #4d9fbb
            0xfbea50, // #fbea50
        ]
    };

    public static readonly FANTASY_TRUNK: ColorPalette = {
        colors: [
            0x251b65, // #251b65
            0xd09406, // #d09406
            0xF8F8FF, // #F8F8FF
            0xdc6767, // #dc6767
        ]
    };

    private static readonly PALETTES: Record<string, ColorPalette> = {
        'daisy': this.DAISY,
        'lily': this.LILY,
        'fall_yellow': this.FALL_YELLOW,
        'fall_red_orange': this.FALL_RED_ORANGE,
        'fantasy_leaves': this.FANTASY_LEAVES,
        'fantasy_trunk': this.FANTASY_TRUNK,
    };

    /**
     * Returns a color interpolated from the given palette based on t (0-1).
     */
    public static getInterpolatedColor(palette: ColorPalette, t: number): number {
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
    public static getPalette(name: string): ColorPalette {
        return this.PALETTES[name.toLowerCase()] || this.DAISY;
    }
}
