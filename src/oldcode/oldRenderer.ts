// oldRenderer.ts
class Renderer {
    private static instance: Renderer;
    private context!: GPUCanvasContext;
    private device!: GPUDevice;
    private canvas: HTMLCanvasElement;

    private constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public async init() {
        // Get the context of the canvas
        const context = this.canvas.getContext('webgpu');
        if (!context) {
            alert('WebGPU not supported on your browser');
            return;
        }
        this.context = context;

        const adapter = await navigator.gpu.requestAdapter();

        if (!adapter) {
            alert('No adapter found');
            return;
        }

        this.device = await adapter.requestDevice();

        this.context.configure({
            device: this.device,
            format: navigator.gpu.getPreferredCanvasFormat(),
        });
    }

    public static getInstance(canvas: HTMLCanvasElement): Renderer {
        if (!Renderer.instance) {
            Renderer.instance = new Renderer(canvas);
        }

        return Renderer.instance;
    }

    public draw(): void {
        // this gives us a new command encoder to encode all the commands for the GPU
        const commandEncoder = this.device.createCommandEncoder();
        // texture to canvas or post processing in the future
        const textureView = this.context.getCurrentTexture().createView();
        // what to do with the texture
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 1, g: 0.1, b: 0.1, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        // start the render pass
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.end();
        // submit the commands to the GPU
        this.device.queue.submit([commandEncoder.finish()]);
    }
}

export default Renderer;
