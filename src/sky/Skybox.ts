import * as THREE from 'three';
import { GraphicsUtils } from '../core/GraphicsUtils';
import { DesignerSettings } from '../core/DesignerSettings';

export class Skybox {
    public mesh: THREE.Mesh;
    private uniforms: { [uniform: string]: THREE.IUniform };

    constructor(scene: THREE.Scene) {
        this.mesh = this.createSkybox();
        scene.add(this.mesh);
    }

    private createSkybox(): THREE.Mesh {
        const skyGeo = new THREE.SphereGeometry(360, 32, 15);
        skyGeo.name = 'Skybox Geometry';

        this.uniforms = {
            lightTop: { value: new THREE.Color(0x00aaff) },
            lightMid: { value: new THREE.Color(0x00ccff) },
            lightBot: { value: new THREE.Color(0xb0e0ff) },
            darkTop: { value: new THREE.Color(0x02040a) },
            darkBot: { value: new THREE.Color(0x0a1128) },
            moonColor: { value: new THREE.Color(0xb0c0d0) },
            sunPos: { value: new THREE.Vector3(0, 1, 0) },
            moonPos: { value: new THREE.Vector3(0, -1, 0) },
            haze: { value: 0.2 },
            dayness: { value: 0.0 }
        };

        const skyMat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([
                this.uniforms,
                THREE.UniformsLib['fog']
            ]),
            vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        #include <fog_pars_vertex>
        void main() {
          vLocalPosition = position;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
            fragmentShader: `
        uniform vec3 lightTop, lightMid, lightBot;
        uniform vec3 darkTop, darkBot;
        uniform vec3 moonColor;
        uniform vec3 sunPos;
        uniform vec3 moonPos;
        uniform float haze;
        uniform float dayness;

        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        #include <fog_pars_fragment>
        void main() {
            vec3 viewDir = normalize(vLocalPosition);
            vec3 sDir = normalize(sunPos);
            vec3 mDir = normalize(moonPos);
            float h = max(viewDir.y, 0.0);
            
            // --- 1. HORIZONTAL INFLUENCE ---
            float sunDot = dot(viewDir, sDir);
            
            // How much the sun affects this specific pixel (Directional Base)
            //float sunWeight = smoothstep(-0.5, 1.0 - haze, sunDot);
            // 0,pi -> 0,1 -> 1,0
            float angle = 1.0 - acos(sunDot)/(3.142);
            float sunWeight = clamp((angle - 0.2)/0.6, 0.0, 1.0);

            // Noon Expansion: Fills the sky at midday
            sunWeight = mix(sunWeight, 1.0, smoothstep(0.0, 0.5, dayness));

            // Night Fade: Zeros the sky at midnight
            sunWeight = mix(0.0, sunWeight, smoothstep(-0.5, 0.0, dayness));

            // --- 2. MULTI-COLOR GRADIENTS ---
            // Light Side (Sun side) 3-color gradient
            float midHeight = 0.25;
            vec3 lightSky;
            if(h < midHeight) {
                lightSky = mix(lightBot, lightMid, h / midHeight);
            } else {
                lightSky = mix(lightMid, lightTop, (h - midHeight) / (1.0 - midHeight));
            }

            // Dark Side (Night/Anti-solar side) 2-color gradient
            vec3 darkSky = mix(darkBot, darkTop, pow(h, 0.7));

            // --- 3. COMPOSITION ---
            // Start with the dark/night base
            vec3 finalColor = darkSky;
            
            // Add the sun's influence (The "Light Side")
            finalColor = mix(finalColor, lightSky, sunWeight);
            
            // Add the Moon Glow (Additive)
            // This creates a silver halo around the moon even in the "dark" side
            float moonGlow = exp(-distance(viewDir, mDir) * 3.0) * 0.4;
            finalColor += moonColor * moonGlow * (1.0 - sunWeight);

            // --- 4. CELESTIAL DISKS ---
            // Sun Disk
            // float sunDist = distance(viewDir, sDir);
            // float sunDisk = smoothstep(0.09, 0.08, sunDist);
            // finalColor = mix(finalColor, vec3(1.0, 0.95, 0.8), sunDisk);

            // Moon Disk
            // float moonDist = distance(viewDir, mDir);
            // float moonDisk = smoothstep(0.07, 0.065, moonDist);
            // finalColor = mix(finalColor, moonColor, moonDisk);

            gl_FragColor = vec4(finalColor, 1.0);
            #include <fog_fragment>
        }
      `,
            side: THREE.BackSide,
            fog: false,
            name: 'Skybox Material'
        });

        // Re-bind uniforms because merge clones them
        this.uniforms = skyMat.uniforms;

        const mesh = GraphicsUtils.createMesh(skyGeo, skyMat, 'SkyboxMesh');
        return mesh;
    }

    update(
        cameraPosition: THREE.Vector3,
        sunPos: THREE.Vector3,
        moonPos: THREE.Vector3,
        colors: {
            lightTop: THREE.Color,
            lightMid: THREE.Color,
            lightBot: THREE.Color,
            darkTop: THREE.Color,
            darkBot: THREE.Color,
            moonColor: THREE.Color
        },
        haze: number,
        dayness: number
    ) {
        this.mesh.position.copy(cameraPosition);

        // Conditional scaling for designer
        if (DesignerSettings.isDesignerMode && this.mesh.scale.x !== 10) {
            this.mesh.scale.set(10, 10, 10);
        }

        this.uniforms.sunPos.value.copy(sunPos);
        this.uniforms.moonPos.value.copy(moonPos);
        this.uniforms.lightTop.value.copy(colors.lightTop);
        this.uniforms.lightMid.value.copy(colors.lightMid);
        this.uniforms.lightBot.value.copy(colors.lightBot);
        this.uniforms.darkTop.value.copy(colors.darkTop);
        this.uniforms.darkBot.value.copy(colors.darkBot);
        this.uniforms.moonColor.value.copy(colors.moonColor);
        this.uniforms.haze.value = haze;
        this.uniforms.dayness.value = dayness;
    }
}
