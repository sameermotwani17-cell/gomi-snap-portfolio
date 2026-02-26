import sharp from 'sharp';

export interface ImageHashResult {
  perceptualHash: string;
  thumbnailData: string;
}

export async function generateImageHash(base64Image: string): Promise<ImageHashResult> {
  const imageBuffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  
  const hashSize = 8;
  const { data: pixels } = await sharp(imageBuffer)
    .resize(hashSize + 1, hashSize, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = '';
  for (let row = 0; row < hashSize; row++) {
    for (let col = 0; col < hashSize; col++) {
      const leftIndex = row * (hashSize + 1) + col;
      const rightIndex = leftIndex + 1;
      
      hash += pixels[leftIndex] < pixels[rightIndex] ? '1' : '0';
    }
  }

  const thumbnail = await sharp(imageBuffer)
    .resize(200, 200, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  const thumbnailData = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;

  return {
    perceptualHash: hash,
    thumbnailData
  };
}
