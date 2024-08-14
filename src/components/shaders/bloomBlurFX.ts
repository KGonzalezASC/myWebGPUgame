import shaderSource from "./blurFX.wgsl?raw"
import {Texture} from "../simpleComponents/texture.ts";
import {BufferUtils} from "../simpleComponents/bufferUtils.ts";


export class BloomBlurFX {
    private gpuBuffer!: GPUBuffer;
    private uniformBuffer!: GPUBuffer;
    private pingPongTexture!: Texture;
    private bindGroupLayout!: GPUBindGroupLayout;
    private gpuHorizontalPassPipeline!: GPURenderPipeline;
    private gpuVerticalPassPipeline!: GPURenderPipeline;

    constructor(private device: GPUDevice, private width: number, private height: number) {}

    private createBindGroup(texture: Texture): GPUBindGroup {
        return this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: texture.sampler },
                { binding: 1, resource: texture.texture.createView() },
                { binding: 2, resource: { buffer: this.uniformBuffer } }
            ]
        });
    }

    private createPipeline(horizontal: boolean): GPURenderPipeline {
        const shaderModule = this.device.createShaderModule({ code: shaderSource });
        return this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
                buffers: [{
                    arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x2" },
                        { shaderLocation: 1, offset: 2 * Float32Array.BYTES_PER_ELEMENT, format: "float32x2" }
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: horizontal ? "fragmentMainHorizontal" : "fragmentMainVertical",
                targets: [{
                    format: "bgra8unorm"
                }]
            },
            primitive: {
                topology: "triangle-strip",
            }
        });
    }

    public async init() {
        this.pingPongTexture = await Texture.createEmptyTexture(this.device, this.width, this.height);

        this.gpuBuffer = BufferUtils.createVertexBuffer(this.device, BufferUtils.defaultVertexBufferData);
        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
            ]
        });

        this.uniformBuffer = this.device.createBuffer({
            size: 4, // Size of an i32
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });


        this.gpuHorizontalPassPipeline = this.createPipeline(true);
        this.gpuVerticalPassPipeline = this.createPipeline(false);
    }


    public draw(textureToApplyEffectTo: Texture) {
        this.device.queue.writeBuffer(this.uniformBuffer, 0, new Int32Array([0]));

        const horizontalBindGroup = this.createBindGroup(textureToApplyEffectTo);
        this.executePass(this.gpuHorizontalPassPipeline, horizontalBindGroup, this.pingPongTexture.texture.createView());

        const verticalBindGroup = this.createBindGroup(this.pingPongTexture);
        this.executePass(this.gpuVerticalPassPipeline, verticalBindGroup, textureToApplyEffectTo.texture.createView());
    }

    private executePass(pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, textureView: GPUTextureView) {
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, this.gpuBuffer);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(6, 1, 0, 0);

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
}
