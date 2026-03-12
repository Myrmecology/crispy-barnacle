/* ============================================================
   CRISPY BARNACLE — PostProcessPipeline.js
   Owns the WebGPU render pipeline for Pass 2.
   Takes the offscreen raymarch texture as input,
   applies the full post-process stack, and writes
   the final result directly to the swap chain.
   ============================================================ */

export class PostProcessPipeline {
  constructor(gpuContext) {
    this.gpu             = gpuContext;
    this.pipeline        = null;
    this.bindGroupLayout = null;
    this.bindGroup       = null;
    this.uniformBuffer   = null;
    this.sampler         = null;

    // Uniform values
    this.time       = 0;
    this.audioLevel = 0;
    this.warp       = 0;
    this.level      = 1;

    // Uniform buffer layout:
    // offset 0  — resolution  vec2<f32>
    // offset 8  — time        f32
    // offset 12 — audioLevel  f32
    // offset 16 — warp        f32
    // offset 20 — level       f32
    // offset 24 — _pad        vec2<f32>
    // total: 32 bytes → padded to 48 for alignment
    this.UNIFORM_SIZE = 48;
  }

  // ── Initialize pipeline ───────────────────────────────────
  async init() {
    const shaderCode = await this._loadShader('/src/gpu/shaders/postprocess.wgsl');

    this.uniformBuffer = this.gpu.createUniformBuffer(this.UNIFORM_SIZE);
    this.sampler       = this.gpu.createLinearSampler();

    this._buildPipeline(shaderCode);
    this._buildBindGroup();

    console.log('[PostProcessPipeline] Initialized.');
  }

  // ── Load WGSL from file ───────────────────────────────────
  async _loadShader(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`[PostProcessPipeline] Cannot load shader: ${path}`);
    return res.text();
  }

  // ── Build render pipeline ─────────────────────────────────
  _buildPipeline(shaderCode) {
    const module = this.gpu.device.createShaderModule({
      label: 'postprocess-shader',
      code:  shaderCode,
    });

    this.bindGroupLayout = this.gpu.device.createBindGroupLayout({
      label: 'postprocess-bgl',
      entries: [
        {
          // Uniforms
          binding:    0,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffer:     { type: 'uniform' },
        },
        {
          // Sampler
          binding:    1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler:    { type: 'filtering' },
        },
        {
          // Raymarch offscreen texture
          binding:    2,
          visibility: GPUShaderStage.FRAGMENT,
          texture:    { sampleType: 'float' },
        },
      ],
    });

    this.pipeline = this.gpu.device.createRenderPipeline({
      label:  'postprocess-pipeline',
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
            // Write directly to the swap chain
            format: this.gpu.format,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    });
  }

  // ── Build bind group ──────────────────────────────────────
  // Called on init and again after every resize
  // because the offscreen texture view changes on resize
  _buildBindGroup() {
    this.bindGroup = this.gpu.device.createBindGroup({
      label:  'postprocess-bg',
      layout: this.bindGroupLayout,
      entries: [
        {
          binding:  0,
          resource: { buffer: this.uniformBuffer },
        },
        {
          binding:  1,
          resource: this.sampler,
        },
        {
          binding:  2,
          resource: this.gpu.offscreenTextureView,
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
    // struct PostUniforms {
    //   resolution : vec2<f32>  offset 0
    //   time       : f32        offset 8
    //   audioLevel : f32        offset 12
    //   warp       : f32        offset 16
    //   level      : f32        offset 20
    //   _pad       : vec2<f32>  offset 24
    // }
    const data = new Float32Array(this.UNIFORM_SIZE / 4);
    data[0] = this.gpu.width;
    data[1] = this.gpu.height;
    data[2] = this.time;
    data[3] = this.audioLevel;
    data[4] = this.warp;
    data[5] = this.level;
    data[6] = 0; // _pad
    data[7] = 0; // _pad

    this.gpu.writeUniform(this.uniformBuffer, data);
  }

  // ── Rebuild bind group after resize ──────────────────────
  // Must be called after GPUContext.handleResize()
  // so we bind the newly created offscreen texture view
  handleResize() {
    this._buildBindGroup();
    console.log('[PostProcessPipeline] Bind group rebuilt after resize.');
  }

  // ── Execute render pass ───────────────────────────────────
  render(encoder) {
    this._writeUniforms();

    const pass = encoder.beginRenderPass({
      label: 'postprocess-pass',
      colorAttachments: [
        {
          // Always get a fresh swap chain view each frame
          view:       this.gpu.getCurrentTextureView(),
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
    console.log('[PostProcessPipeline] Destroyed.');
  }
}