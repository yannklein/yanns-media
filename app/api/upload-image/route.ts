import { uploadImage } from '@/utils/storeOnCloudinary';
import prisma from '@/lib/prisma';
import { getImageBinary } from '@/utils/getImageBinary';

import { NextRequest, NextResponse } from 'next/server';
import { storeLocally } from '@/utils/storeLocally';

export async function POST(req: NextRequest) {
  
  try {
    const { mediaId, mediaPath } = await req.json();    
    const imageBinary = await getImageBinary(mediaPath);

    let imageData; 
    if (process.env.STORAGE_SERVICE === 'cloudinary') {
      imageData = await uploadImage(imageBinary);
    } else if (process.env.STORAGE_SERVICE === 'local') {
      imageData = storeLocally(imageBinary);
    } else {
      throw new Error('Unknown storage service');
    }

    const result = await prisma.image.create({
      data: {
        publicId: imageData.public_id,
        format: imageData.format, 
        version: imageData.version,
        mediaId: mediaId,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Internal server error ${err.message}` },
      { status: 500 },
    );
  }
    

}
