import * as THREE from 'three';

/**
 * Custom shader for leaves that extends MeshToonMaterial.
 * It uses a custom 'hslOffset' attribute for per-leaf variation
 * to avoid conflict with standard vertex color logic.
 */
const toonShader = THREE.ShaderLib.toon;

export const LeafShader = {
    uniforms: THREE.UniformsUtils.merge([
        toonShader.uniforms,
        {
            uSnowFactor: { value: 0.0 }
        }
    ]),

    vertexShader: toonShader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        attribute vec3 hslOffset;
        varying vec3 vHslOffset;
        `
    ).replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vHslOffset = hslOffset;
        `
    ),

    fragmentShader: `
        varying vec3 vHslOffset;
        uniform float uSnowFactor;

        // HSL to RGB Helper
        float leaf_hue2rgb(float p, float q, float t) {
            if (t < 0.0) t += 1.0;
            if (t > 1.0) t -= 1.0;
            if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
            if (t < 1.0/2.0) return q;
            if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
            return p;
        }

        vec3 leaf_hsl2rgb(vec3 hsl) {
            vec3 rgb;
            if (hsl.y == 0.0) {
                rgb = vec3(hsl.z);
            } else {
                float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
                float p = 2.0 * hsl.z - q;
                rgb.r = leaf_hue2rgb(p, q, hsl.x + 1.0/3.0);
                rgb.g = leaf_hue2rgb(p, q, hsl.x);
                rgb.b = leaf_hue2rgb(p, q, hsl.x - 1.0/3.0);
            }
            return rgb;
        }

        // RGB to HSL Helper
        vec3 leaf_rgb2hsl(vec3 c) {
            float maxC = max(c.r, max(c.g, c.b));
            float minC = min(c.r, min(c.g, c.b));
            float h, s, l = (maxC + minC) / 2.0;
            if (maxC == minC) {
                h = s = 0.0;
            } else {
                float d = maxC - minC;
                s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
                if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
                else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
                else h = (c.r - c.g) / d + 4.0;
                h /= 6.0;
            }
            return vec3(h, s, l);
        }
    ` + toonShader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        
        // 1. Convert initial diffuseColor to HSL
        // vHslOffset contains our [HueOffset, SatOffset, LightOffset]
        vec3 hsl = leaf_rgb2hsl(diffuseColor.rgb);

        // 2. Apply offsets
        hsl.x = mod(hsl.x + vHslOffset.r, 1.0);
        hsl.y = clamp(hsl.y + vHslOffset.g, 0.0, 1.0);
        hsl.z = clamp(hsl.z + vHslOffset.b, 0.0, 1.0);

        // 3. Set back to diffuseColor
        diffuseColor.rgb = leaf_hsl2rgb(hsl);

        // 4. Handle Snow
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 1.0), uSnowFactor);
        `
    )
};
