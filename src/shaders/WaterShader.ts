import * as THREE from 'three';

export const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x4da6ff) },
    uFlowDirection: { value: new THREE.Vector2(0, 1) }, // Flow along Z
    uSunPosition: { value: new THREE.Vector3(50, 100, 50) },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec2 uFlowDirection;
    uniform vec3 uSunPosition;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    vec2 rotate(vec2 v, float a) {
      float s = sin(a);
      float c = cos(a);
      mat2 m = mat2(c, -s, s, c);
      return m * v;
    }

    void main() {
      // Base UVs
      vec2 flowUV = vWorldPosition.xz * 0.05; 
      
      // Domain Warping for "Random Curvature"
      // Large scale noise to distort the flow paths
      float warp = snoise(flowUV * 0.5 + uTime * 0.1);
      vec2 warpedUV = flowUV + vec2(warp * 0.2, 0.0); // Distort X primarily
      
      // Flow Parameters
      float speed = 2.0; // Reverted to fast speed
      float stretch = 0.2;
      float scale = 10.0;
      
      // Cross Ripples - Layer 1 (Rotated Left)
      vec2 uv1 = rotate(warpedUV, -0.4); // ~23 degrees
      uv1.y += uTime * speed; // Flow
      uv1.y *= stretch; // Stretch
      float noise1 = snoise(vec2(uv1.x * scale, uv1.y)); 
      
      // Cross Ripples - Layer 2 (Rotated Right)
      vec2 uv2 = rotate(warpedUV, 0.4); // ~23 degrees
      uv2.y += uTime * speed * 1.1; // Slightly different speed to avoid standing waves
      uv2.y *= stretch;
      float noise2 = snoise(vec2(uv2.x * scale, uv2.y));
      
      // Combine Cross Ripples
      // Max blending creates a nice "choppy" look where waves intersect
      float flowPattern = max(noise1, noise2);
      
      // Threshold for "vector" lines
      float lineMix = smoothstep(0.5, 0.8, flowPattern);
      
      // Pulse (Subtle brightness variation)
      float pulse = sin(uTime * 3.0 + vWorldPosition.x * 0.5) * 0.1 + 0.9;
      lineMix *= pulse;
      
      // Toon Shading (Lighting)
      vec3 lightDir = normalize(uSunPosition);
      float diff = max(dot(vNormal, lightDir), 0.0);
      
      // 3-step Toon Ramp
      float lightIntensity;
      if (diff > 0.9) lightIntensity = 1.0;
      else if (diff > 0.5) lightIntensity = 0.8;
      else lightIntensity = 0.6;
      
      // Specular
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 reflectDir = reflect(-lightDir, vNormal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
      float specIntensity = step(0.5, spec); // Hard specular
      
      // Final Color
      vec3 baseColor = uColor * lightIntensity;
      vec3 lineColor = vec3(1.0); // White lines
      
      vec3 finalColor = mix(baseColor, lineColor, lineMix * 0.3); // Blend lines
      finalColor += specIntensity * 0.5; // Add specular
      
      gl_FragColor = vec4(finalColor, 0.8); // Transparency
    }
  `
};
