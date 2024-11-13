import { uploadImage } from '../../../utils/cloudinary';
import prisma from '@/lib/prisma';

import { NextRequest, NextResponse } from 'next/server';

const getImageBinary = async (mediaPath: string) => {
  const url = 'https://content.dropboxapi.com/2/files/get_thumbnail_v2';
  const requestOptions: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
      'Dropbox-API-Arg': JSON.stringify({
        size: 'w64h64',
        resource: {
          '.tag': 'path',
          path: mediaPath,
        },
        format: { '.tag': 'png' },
      }),
    },
    redirect: 'follow',
  };

  const response = await fetch(url, requestOptions);
  const arrayBuffer = await response.arrayBuffer(); // Convert the response to a Blob
  return Buffer.from(arrayBuffer);
};

export async function POST(req: NextRequest) {
  
  try {
    const { mediaId, mediaPath } = await req.json();    
    const imageBinary = await getImageBinary(mediaPath);
    const imageData = await uploadImage(imageBinary);
    
    const result = await prisma.image.create({
      data: {
        publicId: imageData.public_id,
        format: imageData.format, 
        version: imageData.version.toString(),
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
