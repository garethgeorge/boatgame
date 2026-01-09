import * as THREE from 'three';
import { GraphicsUtils } from '../core/GraphicsUtils';

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
            topColor: { value: new THREE.Color(0x0099ff) },
            bottomColor: { value: new THREE.Color(0xffffff) },
            offset: { value: 33 },
            exponent: { value: 0.5 }
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
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vLocalPosition = position;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
            fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        varying vec3 vLocalPosition;
        #include <fog_pars_fragment>
        void main() {
          float h = normalize(vLocalPosition + vec3(0, offset, 0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
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

    update(cameraPosition: THREE.Vector3, topColor: THREE.Color, bottomColor: THREE.Color) {
        this.mesh.position.copy(cameraPosition);
        this.uniforms.topColor.value.copy(topColor);
        this.uniforms.bottomColor.value.copy(bottomColor);
    }
}
