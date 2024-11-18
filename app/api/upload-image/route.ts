import { uploadImage } from '@/utils/cloudinary';
import prisma from '@/lib/prisma';
import { getImageBinary } from '@/utils/getImageBinary';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  
  try {
    const { mediaId, mediaPath } = await req.json();    
    const imageBinary = await getImageBinary(mediaPath);
    const imageData = await uploadImage(imageBinary);
    
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
