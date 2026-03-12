/* ============================================================
   CRISPY BARNACLE — RaymarchPipeline.js
   Owns the WebGPU render pipeline for Pass 1.
   Loads the raymarch WGSL shader, builds the pipeline,
   manages uniforms, and executes the render pass.
   ============================================================ */

export class RaymarchPipeline {
  constructor(gpuContext) {
    this.gpu            = gpuContext;
    this.pipeline       = null;
    this.bindGroupLayout = null;
    this.bindGroup      = null;
    this.uniformBuffer  = null;

    // Uniform values
    this.time       = 0;
    this.audioLevel = 0;
    this.warp       = 0;
    this.level      = 1;

    // Uniform buffer layout:
    // offset 0  — time        f32
    // offset 4  — audioLevel  f32
    // offset 8  — warp        f32
    // offset 12 — level       f32
    // offset 16 — resolution  vec2<f32>
    // offset 24 — _pad        vec2<f32>
    // total: 32 bytes → padded to 48 for 16-byte alignment
    this.UNIFORM_SIZE = 48;
  }

  // ── Initialize pipeline ───────────────────────────────────
  async init() {
    const shaderCode = await this._loadShader('/src/gpu/shaders/raymarch.wgsl');

    this.uniformBuffer = this.gpu.createUniformBuffer(this.UNIFORM_SIZE);

    this._buildPipeline(shaderCode);
    this._buildBindGroup();

    console.log('[RaymarchPipeline] Initialized.');
  }

  // ── Load WGSL from file ───────────────────────────────────
  async _loadShader(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`[RaymarchPipeline] Cannot load shader: ${path}`);
    return res.text();
  }

  // ── Build render pipeline ─────────────────────────────────
  _buildPipeline(shaderCode) {
    const module = this.gpu.device.createShaderModule({
      label: 'raymarch-shader',
      code:  shaderCode,
    });

    this.bindGroupLayout = this.gpu.device.createBindGroupLayout({
      label: 'raymarch-bgl',
      entries: [
        {
          binding:    0,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffer:     { type: 'uniform' },
        },
      ],
    });

    this.pipeline = this.gpu.device.createRenderPipeline({
      label:  'raymarch-pipeline',
      layout: this.gpu.device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        module,
        entryPoint: 'vs_main',
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.gpu.offscreenFormat,
            // Additive blending for glow layering
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology:  'triangle-list',
        cullMode:  'none',
      },
    });
  }

  // ── Build bind group ──────────────────────────────────────
  _buildBindGroup() {
    this.bindGroup = this.gpu.device.createBindGroup({
      label:  'raymarch-bg',
      layout: this.bindGroupLayout,
      entries: [
        {
          binding:  0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });
  }

  // ── Update uniforms ───────────────────────────────────────
  update({ time, audioLevel, warp, level }) {
    this.time       = time;
    this.audioLevel = audioLevel;
    this.warp       = warp;
    this.level      = level;
  }

  // ── Write uniforms to GPU ─────────────────────────────────
  _writeUniforms() {
    // Must match WGSL struct layout exactly:
    // struct Uniforms {
    //   time       : f32,      offset 0
    //   audioLevel : f32,      offset 4
    //   warp       : f32,      offset 8
    //   level      : f32,      offset 12
    //   resolution : vec2<f32> offset 16
    //   _pad       : vec2<f32> offset 24
    // }
    const data = new Float32Array(this.UNIFORM_SIZE / 4);
    data[0] = this.time;
    data[1] = this.audioLevel;
    data[2] = this.warp;
    data[3] = this.level;
    data[4] = this.gpu.width;
    data[5] = this.gpu.height;
    data[6] = 0; // _pad
    data[7] = 0; // _pad

    this.gpu.writeUniform(this.uniformBuffer, data);
  }

  // ── Rebuild bind group after resize ──────────────────────
  handleResize() {
  this._buildBindGroup();
}

  // ── Execute render pass ───────────────────────────────────
  render(encoder) {
    this._writeUniforms();

    const pass = encoder.beginRenderPass({
      label: 'raymarch-pass',
      colorAttachments: [
        {
          view:       this.gpu.offscreenTextureView,
          loadOp:     'clear',
          storeOp:    'store',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6);
    pass.end();
  }

  // ── Destroy ───────────────────────────────────────────────
  destroy() {
    this.uniformBuffer?.destroy();
    console.log('[RaymarchPipeline] Destroyed.');
  }
}