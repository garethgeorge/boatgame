export const SobelShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'resolution': { value: new Float32Array([800, 600]) }
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;

    void main() {
      float x = 1.0 / resolution.x;
      float y = 1.0 / resolution.y;

      vec4 horizEdge = vec4( 0.0 );
      horizEdge -= texture2D( tDiffuse, vec2( vUv.x - x, vUv.y - y ) ) * 1.0;
      horizEdge -= texture2D( tDiffuse, vec2( vUv.x - x, vUv.y     ) ) * 2.0;
      horizEdge -= texture2D( tDiffuse, vec2( vUv.x - x, vUv.y + y ) ) * 1.0;
      horizEdge += texture2D( tDiffuse, vec2( vUv.x + x, vUv.y - y ) ) * 1.0;
      horizEdge += texture2D( tDiffuse, vec2( vUv.x + x, vUv.y     ) ) * 2.0;
      horizEdge += texture2D( tDiffuse, vec2( vUv.x + x, vUv.y + y ) ) * 1.0;

      vec4 vertEdge = vec4( 0.0 );
      vertEdge -= texture2D( tDiffuse, vec2( vUv.x - x, vUv.y - y ) ) * 1.0;
      vertEdge -= texture2D( tDiffuse, vec2( vUv.x    , vUv.y - y ) ) * 2.0;
      vertEdge -= texture2D( tDiffuse, vec2( vUv.x + x, vUv.y - y ) ) * 1.0;
      vertEdge += texture2D( tDiffuse, vec2( vUv.x - x, vUv.y + y ) ) * 1.0;
      vertEdge += texture2D( tDiffuse, vec2( vUv.x    , vUv.y + y ) ) * 2.0;
      vertEdge += texture2D( tDiffuse, vec2( vUv.x + x, vUv.y + y ) ) * 1.0;

      vec3 edge = sqrt((horizEdge.rgb * horizEdge.rgb) + (vertEdge.rgb * vertEdge.rgb));
      float edgeVal = length(edge);

      // Light cell-shading aesthetic: mix original color with edge darkness
      vec4 color = texture2D( tDiffuse, vUv );
      
      // Thresholding for "cell shaded" look - if edge is strong, darken it
      // "Fairly light" means we probably don't want pitch black lines everywhere
      // or we accept the gradient but keep it subtle.
      
      float intensity = 0.3; // Reduced from 0.5
      // Clamp the edge contribution to avoid pitch black lines
      vec3 finalEdge = min(edge.rgb * intensity, vec3(0.3)); 
      
      gl_FragColor = vec4( color.rgb - finalEdge, color.a );
    }
  `
};
