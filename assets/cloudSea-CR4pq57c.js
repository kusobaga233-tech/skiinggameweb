import"./modulepreload-polyfill-B5Qt9EMX.js";const b=`
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`,w=`
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform sampler2D uNoise;
uniform sampler2D uOverlay;

varying vec2 vUv;

#define dot2(v) dot(v, v)
#define layer(dh, v) if (uv.y < h + midlevel - (dh)) return vec4(v, 1.0);

float noiseValue(vec2 x) {
  vec2 f = fract(x);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 p = floor(x);
  float a = texture2D(uNoise, (p + vec2(0.0, 0.0)) / 1024.0).r;
  float b = texture2D(uNoise, (p + vec2(1.0, 0.0)) / 1024.0).r;
  float c = texture2D(uNoise, (p + vec2(0.0, 1.0)) / 1024.0).r;
  float d = texture2D(uNoise, (p + vec2(1.0, 1.0)) / 1024.0).r;
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}

float fbmDetail(vec2 x, float persistence, int detail) {
  float amplitude = 1.0;
  float total = 0.0;
  float weight = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= detail) {
      break;
    }
    float n = noiseValue(x);
    total += amplitude * n;
    weight += amplitude;
    amplitude *= persistence;
    x *= 2.0;
  }
  return total / weight;
}

float fbm(vec2 x, float persistence) {
  return fbmDetail(x, persistence, 8);
}

float box(vec2 uv, float x1, float x2, float y1, float y2) {
  return (uv.x > x1 && uv.x < x2 && uv.y > y1 && uv.y < y2) ? 1.0 : 0.0;
}

vec4 foreground(vec2 uv, float t) {
  float midlevel;
  float h;
  float disp;
  float dist;
  vec2 uv2;

  uv.y -= 0.2;

  midlevel = -0.1;
  disp = 1.7;
  dist = 1.0;
  uv2 = uv + vec2(t / dist + 40.0, 0.0);
  h = (fbmDetail(uv2, 0.72, 4) - 0.5) * disp;
  layer(0.12, vec3(0.43, 0.32, 0.31));
  layer(0.08, vec3(0.55, 0.42, 0.41));
  layer(0.04, vec3(0.66, 0.42, 0.40));
  layer(0.0, vec3(0.77, 0.48, 0.46));

  midlevel = 0.05;
  disp = 1.7;
  dist = 2.0;
  uv2 = uv + vec2(t / dist + 38.0, 0.0);
  h = (fbmDetail(uv2, 0.72, 4) - 0.5) * disp;
  layer(0.1, vec3(0.95, 0.66, 0.48));
  layer(0.04, vec3(0.98, 0.76, 0.64));
  layer(0.0, vec3(0.95, 0.80, 0.77));

  return vec4(0.95, 0.80, 0.77, 0.0);
}

vec4 background(vec2 uv, float t) {
  float midlevel;
  float h;
  float disp;
  float dist;
  vec2 uv2;

  midlevel = 0.3;
  disp = 0.9;
  dist = 10.0;
  uv2 = uv + vec2(t / dist + 32.5, 0.0);
  h = (fbmDetail(uv2, 0.72, 5) - 0.5) * disp;
  layer(0.14, vec3(0.48, 0.19, 0.20));
  layer(0.10, vec3(0.68, 0.28, 0.19));
  layer(0.07, vec3(0.88, 0.38, 0.24));
  layer(0.0, vec3(0.95, 0.45, 0.30));

  midlevel = 0.35;
  disp = 1.0;
  dist = 15.0;
  uv2 = uv + vec2(t / dist + 30.0, 0.0);
  h = (fbmDetail(uv2, 0.72, 5) - 0.5) * disp;
  layer(0.04, vec3(0.98, 0.76, 0.64));
  layer(0.0, vec3(0.95, 0.80, 0.77));

  midlevel = 0.35;
  disp = 3.5;
  dist = 20.0;
  uv2 = uv + vec2(t / dist + 27.5, 0.0);
  h = (fbmDetail(uv2, 0.72, 5) - 0.5) * disp;
  layer(0.12, vec3(0.43, 0.32, 0.31));
  layer(0.08, vec3(0.55, 0.42, 0.41));
  layer(0.04, vec3(0.66, 0.42, 0.40));
  layer(0.0, vec3(0.77, 0.48, 0.46));

  midlevel = 0.45;
  disp = 2.0;
  dist = 25.0;
  uv2 = uv + vec2(t / dist + 23.0, 0.0);
  h = (fbmDetail(uv2, 0.72, 6) - 0.5) * disp;
  layer(0.04, vec3(0.98, 0.57, 0.36));
  layer(0.0, vec3(1.0, 0.62, 0.44));

  midlevel = 0.5;
  disp = 2.3;
  dist = 30.0;
  uv2 = uv + vec2(t / dist + 20.5, 0.0);
  h = (fbmDetail(uv2, 0.71, 6) - 0.5) * disp;
  layer(0.12, vec3(0.41, 0.27, 0.27));
  layer(0.08, vec3(0.53, 0.35, 0.32));
  layer(0.04, vec3(0.80, 0.24, 0.17));
  layer(0.0, vec3(0.99, 0.29, 0.20));

  midlevel = 0.5;
  disp = 2.5;
  dist = 35.0;
  uv2 = uv + vec2(t / dist + 18.0, 0.0);
  h = (fbmDetail(uv2, 0.7, 7) - 0.5) * disp;
  layer(0.1, vec3(0.88, 0.38, 0.24));
  layer(0.05, vec3(0.98, 0.42, 0.28));
  layer(0.0, vec3(1.0, 0.48, 0.35));

  midlevel = 0.6;
  disp = 2.0;
  dist = 40.0;
  uv2 = uv + vec2(t / dist + 18.0, 0.0);
  h = (fbm(uv2, 0.7) - 0.5) * disp;
  layer(0.1, vec3(0.95, 0.66, 0.48));
  layer(0.0, vec3(1.0, 0.76, 0.60));

  midlevel = 0.75;
  disp = 3.5;
  dist = 45.0;
  uv2 = uv + vec2(t / dist + 15.5, 0.0);
  h = (fbm(uv2, 0.7) - 0.5) * disp;
  layer(0.2, vec3(1.0, 0.55, 0.33));
  layer(0.15, vec3(0.98, 0.50, 0.24));
  layer(0.1, vec3(0.90, 0.55, 0.40));
  layer(0.0, vec3(1.0, 0.62, 0.44));

  midlevel = 0.7;
  disp = 2.7;
  dist = 50.0;
  uv2 = uv + vec2(t / dist + 12.0, 0.0);
  h = (fbm(uv2, 0.7) - 0.5) * disp;
  layer(0.04, vec3(0.73, 0.36, 0.30));
  layer(0.0, vec3(0.80, 0.40, 0.34));

  midlevel = 0.8;
  disp = 2.7;
  dist = 60.0;
  uv2 = uv + vec2(t / dist + 9.5, 0.0);
  h = (fbm(uv2, 0.7) - 0.5) * disp;
  layer(0.1, vec3(0.93, 0.58, 0.35));
  layer(0.0, vec3(1.0, 0.76, 0.60));

  midlevel = 0.9;
  disp = 3.0;
  dist = 70.0;
  uv2 = uv + vec2(t / dist + 7.0, 0.0);
  h = (fbm(uv2, 0.7) - 0.5) * disp;
  layer(0.1, vec3(0.56, 0.25, 0.22));
  layer(0.05, vec3(0.60, 0.30, 0.27));
  layer(0.0, vec3(0.74, 0.35, 0.30));

  midlevel = 1.0;
  disp = 5.0;
  dist = 100.0;
  uv2 = uv + vec2(t / dist + 3.5, 0.0);
  h = (fbm(uv2, 0.7) - 0.5) * disp;
  layer(0.1, vec3(0.92, 0.85, 0.82));
  layer(0.0, vec3(1.0, 0.94, 0.91));

  return vec4(0.58, 0.7, 1.0, 1.0);
}

void main() {
  vec2 fragCoord = vUv * uResolution;
  vec2 uv = fragCoord / uResolution.y;
  float t = uTime * 4.0;
  vec4 bg = background(uv, t);

  vec4 fg = vec4(0.0);
  int n = 5;
  if (uv.y < 0.5) {
    for (int i = 0; i < 5; i++) {
      fg += foreground(uv, t + 4.0 * float(i) / float(n) / 60.0) / float(n);
    }
  }

  vec3 col = bg.rgb;
  float k;
  float h;
  float dist;
  vec2 uv2;
  uv.y -= 0.2;

  uv2 = fract(uv * 9.0);
  float wagon = 1.0;
  wagon *= 1.0 - step(0.45, uv.x);
  wagon *= 1.0 - step(0.115, uv.y);
  wagon *= step(0.103, uv.y);
  wagon *= step(0.05, 1.0 - abs(uv2.x * 2.0 - 1.0));

  float join = 1.0;
  join *= 1.0 - step(0.45, uv.x);
  join *= 1.0 - step(0.11, uv.y);
  join *= step(0.107, uv.y);

  float roof = 1.0;
  roof *= 1.0 - step(0.45, uv.x);
  roof *= 1.0 - step(0.117, uv.y);
  roof *= step(0.11, uv.y);
  roof *= step(0.15, 1.0 - abs(uv2.x * 2.0 - 1.0));

  float loco = box(uv, 0.45, 0.5, 0.103, 0.112);
  float chem1 = box(uv, 0.49, 0.495, 0.103, 0.12);
  float chem2 = box(uv, 0.488, 0.496, 0.12, 0.123);
  float locoRoof = box(uv, 0.443, 0.47, 0.11, 0.117);

  float wheel = 1.0 - step(0.00004, dot2(uv - vec2(0.457, 0.106)));
  wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.487, 0.105)));
  wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.497, 0.105)));

  if (uv.x < 0.45 && uv.y > 0.025 && uv.y < 0.2) {
    wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.2, 0.95)));
    wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.8, 0.95)));
  }

  col = mix(col, vec3(0.18, 0.12, 0.15), join);
  col = mix(col, vec3(0.48, 0.19, 0.20), wagon);
  col = mix(col, vec3(0.18, 0.12, 0.15), roof);
  col = mix(col, vec3(0.38, 0.19, 0.20), loco);
  col = mix(col, vec3(0.38, 0.19, 0.20), chem1);
  col = mix(col, vec3(0.18, 0.12, 0.15), locoRoof);
  col = mix(col, vec3(0.18, 0.12, 0.15), chem2 + wheel);

  dist = 5.0;
  uv2 = uv + vec2(t / dist + 3.5, 0.0);
  uv2.x -= t / dist * 0.2;
  h = fbm(uv2, 0.9) - 0.55;
  if (uv.x < 0.49) {
    float x = -uv.x + 0.49;
    float y = abs(uv.y + h * 0.4 - 0.16 * sqrt(x) - 0.12) - 0.8 * x * exp(-x * 10.0);
    if (y < 0.0) {
      col = vec3(1.0, 0.94, 0.91);
    }
    if (y < -0.02) {
      col = vec3(0.92, 0.85, 0.82);
    }
  }

  dist = 5.0;
  uv2 = uv + vec2(t / dist + 32.5, 0.0);
  uv2.x = fract(uv2.x * 3.0);
  k = 1.0;
  k *= smoothstep(0.001, 0.003, abs(uv2.y - pow(uv2.x - 0.5, 2.0) * 0.15 - 0.12));
  k *= min(step(0.05, 1.0 - abs(uv2.x * 2.0 - 1.0)) + step(0.17, uv2.y), 1.0);
  k *= min(smoothstep(0.02, 0.05, 1.0 - abs(uv2.x * 2.0 - 1.0)) + step(0.177, uv2.y), 1.0);
  k *= min(step(0.1, uv2.y) + smoothstep(-0.09, -0.085, -uv2.y - 0.001 / (1.0 - abs(uv2.x * 2.0 - 1.0))), 1.0);
  k *= min(
    smoothstep(0.05, 0.2, 1.0 - abs(fract(uv2.x * 16.0) * 2.0 - 1.0)) +
    step(0.12, uv2.y - pow(uv2.x - 0.5, 2.0) * 0.15) +
    step(-0.1, -uv2.y),
    1.0
  );
  col = mix(vec3(0.29, 0.09, 0.08) * smoothstep(-0.08, 0.08, uv.y), col, k);

  col = mix(col, fg.rgb, fg.a);

  vec2 screenUv = fragCoord / uResolution.xy;
  col = mix(col, texture2D(uOverlay, screenUv).rgb, 0.3);
  gl_FragColor = vec4(col, 1.0);
}
`;function d(e){let r=e>>>0;return()=>(r=1664525*r+1013904223>>>0,r/4294967295)}function m(e,r){const t=new Uint8Array(e*e*4);let o=0;for(let a=0;a<e;a++)for(let i=0;i<e;i++){const[v,c,s]=r(i,a);t[o++]=v,t[o++]=c,t[o++]=s,t[o++]=255}return t}function E(e){const r=d(5370206);return m(e,()=>{const t=Math.floor(r()*255);return[t,t,t]})}function g(e){const r=d(202429930);return m(e,(t,o)=>{const a=t/Math.max(1,e-1),i=o/Math.max(1,e-1),v=r()*.05+r()*.03,c=Math.pow(16*a*i*(1-a)*(1-i),.2),s=.5+.5*Math.min(1,c)+v,p=Math.min(1,s*.99),y=Math.min(1,s*.97),x=Math.min(1,s*.95);return[Math.floor(p*255),Math.floor(y*255),Math.floor(x*255)]})}function l(e,r,t){const o=e.createShader(r);if(!o)throw new Error("Unable to allocate shader.");if(e.shaderSource(o,t),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS)){const a=e.getShaderInfoLog(o)??"Unknown shader compile error.";throw e.deleteShader(o),new Error(a)}return o}function T(e,r,t){const o=e.createProgram();if(!o)throw new Error("Unable to allocate WebGL program.");const a=l(e,e.VERTEX_SHADER,r),i=l(e,e.FRAGMENT_SHADER,t);if(e.attachShader(o,a),e.attachShader(o,i),e.linkProgram(o),e.deleteShader(a),e.deleteShader(i),!e.getProgramParameter(o,e.LINK_STATUS)){const v=e.getProgramInfoLog(o)??"Unknown program link error.";throw e.deleteProgram(o),new Error(v)}return o}function n(e,r,t){const o=e.getUniformLocation(r,t);if(!o)throw new Error(`Missing uniform: ${t}`);return o}function u(e,r,t,o){const a=e.createTexture();if(!a)throw new Error("Unable to allocate texture.");return e.activeTexture(e.TEXTURE0+r),e.bindTexture(e.TEXTURE_2D,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,t,0,e.RGBA,e.UNSIGNED_BYTE,o),a}class R{canvas;gl;program;uniforms;positionLocation;animationStart=performance.now();frameHandle=0;constructor(r){this.canvas=r;const t=r.getContext("webgl",{antialias:!0,alpha:!1,premultipliedAlpha:!1});if(!t)throw new Error("WebGL is not available in this browser.");this.gl=t,this.program=T(t,b,w),this.positionLocation=t.getAttribLocation(this.program,"aPosition"),this.uniforms={resolution:n(t,this.program,"uResolution"),time:n(t,this.program,"uTime"),noise:n(t,this.program,"uNoise"),overlay:n(t,this.program,"uOverlay")};const o=t.createBuffer();if(!o)throw new Error("Unable to allocate geometry buffer.");t.bindBuffer(t.ARRAY_BUFFER,o),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),t.STATIC_DRAW),t.useProgram(this.program),t.enableVertexAttribArray(this.positionLocation),t.vertexAttribPointer(this.positionLocation,2,t.FLOAT,!1,0,0),u(t,0,1024,E(1024)),u(t,1,256,g(256)),t.uniform1i(this.uniforms.noise,0),t.uniform1i(this.uniforms.overlay,1)}start(){const r=()=>{this.resize(),this.draw((performance.now()-this.animationStart)/1e3),this.frameHandle=window.requestAnimationFrame(r)};this.frameHandle||r()}stop(){this.frameHandle&&(window.cancelAnimationFrame(this.frameHandle),this.frameHandle=0)}resize(){const r=Math.min(window.devicePixelRatio||1,2),t=Math.max(1,Math.floor(this.canvas.clientWidth*r)),o=Math.max(1,Math.floor(this.canvas.clientHeight*r));this.canvas.width===t&&this.canvas.height===o||(this.canvas.width=t,this.canvas.height=o,this.gl.viewport(0,0,t,o))}draw(r){this.gl.useProgram(this.program),this.gl.uniform2f(this.uniforms.resolution,this.canvas.width,this.canvas.height),this.gl.uniform1f(this.uniforms.time,r),this.gl.drawArrays(this.gl.TRIANGLES,0,6)}}function h(e){const r=document.getElementById(e);if(!r)throw new Error(`Missing element: ${e}`);return r}const A=h("cloud-sea-canvas"),f=h("fallback-message");try{new R(A).start()}catch(e){f.hidden=!1,f.textContent=e instanceof Error?e.message:String(e)}
