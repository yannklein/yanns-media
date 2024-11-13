import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function imageSrc(image: any) {
  return `https://res.cloudinary.com/${process.env.CLOUD_NAME}/v${image.version}/${image.publicId}.${image.format}`
}

export function uploadImage(imageUploaded: any) {
  try {
    return new Promise((resolve, reject) => {
      const cld_upload_stream = cloudinary.uploader.upload_stream(
        {
          folder: 'yanns-media',
        },
        (error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        },
      );
      streamifier.createReadStream(imageUploaded).pipe(cld_upload_stream);
    });
  } catch (error) {
    console.error(error);
  }
}
