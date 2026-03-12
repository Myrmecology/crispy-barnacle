/* ============================================================
   CRISPY BARNACLE — GPUContext.js
   Initializes and owns the WebGPU device, adapter, canvas,
   and swap chain. Every pipeline and shader goes through here.
   ============================================================ */

export class GPUContext {
  constructor() {
    this.canvas      = null;
    this.adapter     = null;
    this.device      = null;
    this.context     = null;
    this.format      = null;
    this.width       = 0;
    this.height      = 0;

    // Offscreen texture for multi-pass rendering
    this.offscreenTexture     = null;
    this.offscreenTextureView = null;
    this.offscreenFormat      = 'rgba16float';

    // Depth texture for 3D rendering
    this.depthTexture         = null;
    this.depthTextureView     = null;
    this.depthFormat          = 'depth24plus';
  }

  // ── Initialize WebGPU ─────────────────────────────────────
  async init() {
  this._setupCanvas();
  await this._requestAdapter();
  await this._requestDevice();
  this._configureContext();
  this._createOffscreenTexture();
  this._createDepthTexture();

  console.log('[GPUContext] Initialized.', {
    width:  this.width,
    height: this.height,
    format: this.format,
  });
}

  // ── Canvas setup ─────────────────────────────────────────
  _setupCanvas() {
    this.canvas        = document.getElementById('gpu-canvas');
    this.width         = window.innerWidth;
    this.height        = window.innerHeight;
    this.canvas.width  = this.width;
    this.canvas.height = this.height;
  }

  // ── Adapter ──────────────────────────────────────────────
  async _requestAdapter() {
    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!this.adapter) {
      throw new Error('[GPUContext] No WebGPU adapter found.');
    }
  }

  // ── Device ───────────────────────────────────────────────
  async _requestDevice() {
    this.device = await this.adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {
        maxTextureDimension2D:        this.adapter.limits.maxTextureDimension2D,
        maxBufferSize:                this.adapter.limits.maxBufferSize,
        maxUniformBufferBindingSize:  this.adapter.limits.maxUniformBufferBindingSize,
      },
    });

    // Handle device loss gracefully
    this.device.lost.then((info) => {
      console.error('[GPUContext] Device lost:', info.message);
      if (info.reason !== 'destroyed') {
        console.warn('[GPUContext] Attempting recovery...');
        this.init();
      }
    });
  }

  // ── Context & swap chain ─────────────────────────────────
  _configureContext() {
    this.context = this.canvas.getContext('webgpu');
    this.format  = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device:    this.device,
      format:    this.format,
      alphaMode: 'premultiplied',
      usage:     GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  // ── Offscreen texture (multi-pass target) ─────────────────
  _createOffscreenTexture() {
    if (this.offscreenTexture) {
      this.offscreenTexture.destroy();
    }

    this.offscreenTexture = this.device.createTexture({
      size:   [this.width, this.height, 1],
      format: this.offscreenFormat,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING   |
        GPUTextureUsage.COPY_SRC,
    });

    this.offscreenTextureView = this.offscreenTexture.createView();
  }

  // ── Depth texture (for 3D game rendering) ────────────────
  _createDepthTexture() {
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.device.createTexture({
      size:   [this.width, this.height, 1],
      format: this.depthFormat,
      usage:  GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.depthTextureView = this.depthTexture.createView();
  }

  // ── Handle window resize ──────────────────────────────────
  handleResize() {
    const newWidth  = window.innerWidth;
    const newHeight = window.innerHeight;

    if (newWidth === this.width && newHeight === this.height) return;

    this.width         = newWidth;
    this.height        = newHeight;
    this.canvas.width  = this.width;
    this.canvas.height = this.height;

    this._configureContext();
    this._createOffscreenTexture();
    this._createDepthTexture();

    console.log('[GPUContext] Resized:', this.width, 'x', this.height);
  }

  // ── Get current swap chain texture view ───────────────────
  getCurrentTextureView() {
    return this.context.getCurrentTexture().createView();
  }

  // ── Create a uniform buffer ───────────────────────────────
  createUniformBuffer(sizeInBytes) {
    return this.device.createBuffer({
      size:  Math.ceil(sizeInBytes / 16) * 16, // 16-byte aligned
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // ── Write to a uniform buffer ─────────────────────────────
  writeUniform(buffer, data) {
    this.device.queue.writeBuffer(buffer, 0, data);
  }

  // ── Create a simple linear sampler ───────────────────────
  createLinearSampler() {
    return this.device.createSampler({
      magFilter:     'linear',
      minFilter:     'linear',
      mipmapFilter:  'linear',
      addressModeU:  'clamp-to-edge',
      addressModeV:  'clamp-to-edge',
    });
  }

  // ── Submit a command encoder ──────────────────────────────
  submit(encoder) {
    this.device.queue.submit([encoder.finish()]);
  }

  // ── Destroy everything cleanly ────────────────────────────
  destroy() {
    this.offscreenTexture?.destroy();
    this.depthTexture?.destroy();
    this.device?.destroy();
    console.log('[GPUContext] Destroyed.');
  }
}