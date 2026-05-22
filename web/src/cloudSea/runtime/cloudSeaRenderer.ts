import { CLOUD_SEA_FRAGMENT_SHADER, CLOUD_SEA_VERTEX_SHADER } from "./cloudSeaShader";
import { createNoiseTextureData, createOverlayTextureData } from "./cloudSeaTextures";

type UniformHandles = {
  resolution: WebGLUniformLocation;
  time: WebGLUniformLocation;
  noise: WebGLUniformLocation;
  overlay: WebGLUniformLocation;
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to allocate shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to allocate WebGL program.");
  }

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program link error.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function requiredUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const uniform = gl.getUniformLocation(program, name);
  if (!uniform) {
    throw new Error(`Missing uniform: ${name}`);
  }
  return uniform;
}

function createRepeatTexture(gl: WebGLRenderingContext, unit: number, size: number, data: Uint8Array): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Unable to allocate texture.");
  }
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return texture;
}

export class CloudSeaRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly uniforms: UniformHandles;
  private readonly positionLocation: number;
  private readonly animationStart = performance.now();
  private frameHandle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false, premultipliedAlpha: false });
    if (!gl) {
      throw new Error("WebGL is not available in this browser.");
    }

    this.gl = gl;
    this.program = createProgram(gl, CLOUD_SEA_VERTEX_SHADER, CLOUD_SEA_FRAGMENT_SHADER);
    this.positionLocation = gl.getAttribLocation(this.program, "aPosition");
    this.uniforms = {
      resolution: requiredUniform(gl, this.program, "uResolution"),
      time: requiredUniform(gl, this.program, "uTime"),
      noise: requiredUniform(gl, this.program, "uNoise"),
      overlay: requiredUniform(gl, this.program, "uOverlay")
    };

    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("Unable to allocate geometry buffer.");
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    createRepeatTexture(gl, 0, 1024, createNoiseTextureData(1024));
    createRepeatTexture(gl, 1, 256, createOverlayTextureData(256));
    gl.uniform1i(this.uniforms.noise, 0);
    gl.uniform1i(this.uniforms.overlay, 1);
  }

  start(): void {
    const render = () => {
      this.resize();
      this.draw((performance.now() - this.animationStart) / 1000);
      this.frameHandle = window.requestAnimationFrame(render);
    };

    if (!this.frameHandle) {
      render();
    }
  }

  stop(): void {
    if (this.frameHandle) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  private draw(timeSeconds: number): void {
    this.gl.useProgram(this.program);
    this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    this.gl.uniform1f(this.uniforms.time, timeSeconds);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }
}
