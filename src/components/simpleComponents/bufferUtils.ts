export class BufferUtils{
    /**
     * Create a vertex buffer, this was orginally from RendererProider.tsx
     * @param device
     * @param vertices
     * @returns
     */
     public static createVertexBuffer(device: GPUDevice, vertices: Float32Array): GPUBuffer {
        const buffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,  //this means that the buffer will be used to store vertex data and will be copied to the GPU
            mappedAtCreation: true, //u should dynamically map the buffer to copy the data to it but this is fine for now
        });
        //copy the data to the buffer
        new Float32Array(buffer.getMappedRange()).set(vertices);
        //unmap the bufffer which means the buffer is ready to be used by the GPU
        buffer.unmap();
        return buffer;
    }

    //everything is a square so no need to redefine the vertices every time
    static defaultVertexBufferData: Float32Array = new Float32Array([
        // pos (x,y)  texCoord (u,v)
        // first triangle
        -1.0, 1.0, 0.0, 0.0,
        1.0, 1.0, 1.0, 0.0,
        -1.0, -1.0, 0.0, 1.0,
        // second triangle
        -1.0, -1.0, 0.0, 1.0,
        1.0, 1.0, 1.0, 0.0,
        1.0, -1.0, 1.0, 1.0
    ]);


    public static createIndexBuffer(device: GPUDevice, indices: Uint16Array): GPUBuffer {
        const buffer = device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        //main difference is that this is a Uint16Array
        //u16 is used because the max number of vertices is 65535
        //u32 is used for larger models
        //number of bits for u16 is 2^16 for each vertex
        new Uint16Array(buffer.getMappedRange()).set(indices);
        buffer.unmap();
        return buffer;

    }

    //uniform buffer is a buffer that is used to store
    //constant data so that it is the same across draw calls.
    //this is used to store data that is the same across all vertices
    //uniforms are readonly because they are set by the CPU and read by the GPU
    //they also handle simpler data for shader whereas bindgroups deal with textures and samplers
    //bind groups are dynamic and can be updated every frame
    public static createUniformBuffer(device: GPUDevice, data: Float32Array): GPUBuffer {
        //sorta of global in shader terms
        return device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false, //we dont need to map this buffer because we are not copying data to it
        });
    }
}
