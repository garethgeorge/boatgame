import * as THREE from 'three';

export const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x4da6ff) },
    uFlowDirection: { value: new THREE.Vector2(0, 1) }, // Flow along Z
    uSunPosition: { value: new THREE.Vector3(50, 100, 50) },
    uBoatPosition: { value: new THREE.Vector3(0, 0, 0) },
    uBoatVelocity: { value: new THREE.Vector2(0, 0) },
    uBoatDirection: { value: new THREE.Vector2(0, -1) },
    uBoatHistory: { value: new Array(8).fill(new THREE.Vector3(0, 0, 0)) },
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
    uniform vec3 uBoatPosition;
    uniform vec2 uBoatVelocity;
    uniform vec2 uBoatDirection;
    uniform vec3 uBoatHistory[8];

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

    // Distance from point p to line segment ab
    float distToSegment(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * h);
    }

    void main() {
      // Base UVs
      vec2 flowUV = vWorldPosition.xz * 0.05; 
      
      // Domain Warping for "Random Curvature"
      float warp = snoise(flowUV * 0.5 + uTime * 0.1);
      vec2 warpedUV = flowUV + vec2(warp * 0.2, 0.0); 
      
      // Flow Parameters
      float speed = 0.6; 
      float stretch = 0.15; 
      float scale = 10.0;
      
      // Primary Flow Layer
      vec2 uv1 = warpedUV;
      uv1.y += uTime * speed; 
      uv1.y *= stretch; 
      float noise1 = snoise(vec2(uv1.x * scale, uv1.y)); 
      
      // Secondary Flow Layer
      vec2 uv2 = warpedUV;
      uv2.y += uTime * speed * 1.2;
      uv2.y *= stretch;
      float noise2 = snoise(vec2(uv2.x * scale * 1.5 + 10.0, uv2.y * 1.5));
      
      // Combine
      float flowPattern = noise1 * 0.7 + noise2 * 0.3;
      
      // Threshold for "vector" lines
      float lineMix = smoothstep(0.4, 0.7, flowPattern);
      
      // Pulse
      float pulse = sin(uTime * 3.0 + vWorldPosition.x * 0.5) * 0.1 + 0.9;
      lineMix *= pulse;

      // --- Boat Wake Logic ---
      float wakeMix = 0.0;
      
      // History Trail (Persistent Wake)
      vec2 prevPos = uBoatPosition.xz;
      for (int i = 0; i < 8; i++) {
        vec2 histPos = uBoatHistory[i].xz;
        
        // Skip if history point is effectively zero (uninitialized)
        if (length(histPos) < 0.1) break;
        
        float d = distToSegment(vWorldPosition.xz, prevPos, histPos);
        
        // Trail width expands with age
        float age = float(i);
        float width = 1.5 + age * 0.8; 
        
        if (d < width) {
          float intensity = smoothstep(width, width * 0.5, d);
          
          // Add noise to trail
          float trailNoise = snoise(vWorldPosition.xz * 0.5 + uTime * 0.5);
          intensity *= (0.5 + 0.5 * trailNoise);
          
          // Fade based on index (age)
          float ageFade = 1.0 - (age / 8.0);
          
          wakeMix = max(wakeMix, intensity * ageFade * 0.6);
        }
        
        prevPos = histPos;
      }
      
      // Clamp wake
      wakeMix = clamp(wakeMix, 0.0, 1.0);
      
      // --- End Wake Logic ---
      
      // Toon Shading (Lighting)
      vec3 lightDir = normalize(uSunPosition);
      float diff = max(dot(vNormal, lightDir), 0.0);
      
      // 3-step Toon Ramp
      float lightIntensity;
      if (diff > 0.9) lightIntensity = 1.0;
      else if (diff > 0.5) lightIntensity = 0.8;
      else lightIntensity = 0.6;
      
      // Final Color
      vec3 baseColor = uColor * lightIntensity;
      vec3 lineColor = vec3(1.0); // White lines
      
      // Combine flow lines and wake
      float totalWhiteMix = clamp(lineMix * 0.1 + wakeMix * 0.8, 0.0, 1.0);
      
      vec3 finalColor = mix(baseColor, lineColor, totalWhiteMix);
      
      gl_FragColor = vec4(finalColor, 0.8); // Transparency
    }
  `
};
