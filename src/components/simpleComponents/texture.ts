import {Rect} from "./rect.ts";
export class Texture {

    constructor(public texture: GPUTexture, public sampler: GPUSampler, public id: string, public width:number, public height: number) { }

    public static async createTexture(device: GPUDevice, image: HTMLImageElement): Promise<Texture> {
        const texture = device.createTexture({
            size:  { width: image.width, height: image.height },
            format: 'bgra8unorm',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Wait for the ImageBitmap to be created
        const bitmap = await createImageBitmap(image);
        device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture: texture },
            { width: image.width, height: image.height }
        );

        //handles anti-aliasing and mipmapping among other things
        const sampler = device.createSampler(
            {
                //linear reduces aliasing good for vector art
                //nearest is the fastest but most aliased good for pixel art
                magFilter: 'nearest',
                minFilter: 'nearest',
            }
        );
        return new Texture(texture, sampler,image.src, image.width, image.height);
    }
    /**
     * Load a texture from a URL
     * @param device
     * @param url
     * @returns
     */
    public static async createTextureFromURL(device: GPUDevice, url: string): Promise<Texture> {
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous"; // Needed for CORS policy compliance if applicable
            image.src = url;
            image.onload = () => resolve(image);
            image.onerror = (error) => {
                console.error(`Failed to load image at ${url}`, error);
                reject(new Error(`Failed to load image at ${url}`));
            };
        });

        try {
            const image = await promise;
            return Texture.createTexture(device, image);
        } catch (error) {
            console.error("Error creating texture from URL:", error);
            throw error; // Or return a default/fallback texture
        }
    }

    public static async createEmptyTexture(
        device: GPUDevice, width: number, height: number,
        format: GPUTextureFormat = "bgra8unorm"): Promise<Texture> {

        const texture = device.createTexture({
            size: { width: width, height: height },
            format: format,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });


        const sampler = device.createSampler({
            magFilter: "nearest",
            minFilter: "nearest",
        });

        return new Texture(texture, sampler, "", width, height);
    }

    /**
     * Create a new texture from a portion of an existing texture
     * @param device GPUDevice
     * @param sourceTexture Source texture to copy from
     * @param rect Rectangle defining the portion of the texture to copy
     * @returns New Texture containing the specified portion
     */
    public static async createTextureFromPortion(
        device: GPUDevice,
        sourceTexture: GPUTexture,
        rect: Rect
    ): Promise<Texture> {
        // Create a new texture with the dimensions of the portion
        const newTexture = device.createTexture({
            size: { width: rect.width, height: rect.height },
            format: 'bgra8unorm',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Create a command encoder
        const commandEncoder = device.createCommandEncoder();

        // Copy the specified portion of the source texture to the new texture
        commandEncoder.copyTextureToTexture(
            {
                texture: sourceTexture,
                origin: { x: rect.x, y: rect.y, z: 0 }
            },
            {
                texture: newTexture
            },
            {
                width: rect.width,
                height: rect.height,
                depthOrArrayLayers: 1
            }
        );

        // Submit the commands
        device.queue.submit([commandEncoder.finish()]);

        // Create a sampler for the new texture
        const sampler = device.createSampler({
            magFilter: 'nearest',
            minFilter: 'nearest',
        });

        // Return the new Texture object
        return new Texture(newTexture, sampler, `portion_${Math.random().toString(36).substring(2)}`, rect.width, rect.height);
    }

    //make static async create a copy of the texture
    public static async createTextureCopy(device: GPUDevice, texture: GPUTexture): Promise<Texture> {
        const textureCopy = device.createTexture({
            size: { width: texture.width, height: texture.height },
            format: texture.format,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyTextureToTexture(
            { texture: texture },
            { texture: textureCopy },
            { width: texture.width, height: texture.height, depthOrArrayLayers: 1 }
        );
        device.queue.submit([commandEncoder.finish()]);

        const sampler = device.createSampler({
            magFilter: 'nearest',
            minFilter: 'nearest',
        });
        return new Texture(textureCopy, sampler, `copy_${Math.random().toString(36).substring(2)}`, texture.width, texture.height);
    }
}