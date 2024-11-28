import { uploadImage } from '../utils/storeOnCloudinary';
import { getImageBinary } from '../utils/getImageBinary';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { readdir } from 'fs/promises';
import { storeLocally } from '../utils/storeLocally';
import exifr from 'exifr';
import resizeImg from 'resize-img';

const prisma = new PrismaClient();

type DataEntry = {
  '.tag': string;
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  client_modified: string;
  server_modified: string;
  rev: string;
  size: number;
  is_downloadable: boolean;
  content_hash: string;
};

type MediaDTO = {
  dropbox_id: string;
  path: string;
  date?: Date;
  latitude?: number;
  longitude?: number;
  event?: string;
};

type ImageDTO = {
  publicId: string;
  format: string;
  version: number;
  mediaId: string;
};

let foundMedia = 0;
let foundEvent = 0;
let createdMedia = 0;
const skippedMedia = {
  wrongExtention: 0,
  eventMissing: 0,
  coordsMissing: 0,
  noImageData: 0,
  noMetatag: 0,
};
const seedStart = new Date();

const logger = (message: string) => {
  fs.appendFileSync('./prisma/seed.log', `${message}\n`);
  console.log(message);
};

async function resetDb() {
  await prisma.image.deleteMany({});
  await prisma.media.deleteMany({});

  // remove all images files from the public/mediasThumbnails folder
  if (process.env.STORAGE_SERVICE === 'local') {
    fs.readdirSync('./public/mediasThumbnails').forEach((file) => {
      fs.unlinkSync(`./public/mediasThumbnails/${file}`);
    });
  }
}

const getDropboxResource = async (
  path: string,
  recursive?: boolean,
): Promise<{ entries: DataEntry[]; has_more: boolean; cursor?: string }> => {
  try {
    const raw = JSON.stringify({
      path: path,
      recursive: recursive,
    });

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: raw,
      redirect: 'follow',
    };
    const endpoint = 'https://api.dropboxapi.com/2/files/list_folder';
    const response = await fetch(endpoint, requestOptions);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, reason: ${data.error_summary}, endpoint: ${endpoint}`,
      );
    }
    return data;
  } catch (error) {
    console.error(error);
    return { entries: [], has_more: false };
  }
};

const getDropboxFinalResource = async (path: string): Promise<DataEntry[]> => {
  try {
    const firstData = await getDropboxResource(path, true);
    if (!firstData.has_more) {
      return firstData.entries.filter((entry) => entry['.tag'] === 'file');
    }

    const raw = JSON.stringify({
      cursor: firstData.cursor,
    });

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: raw,
      redirect: 'follow',
    };

    const endpoint = 'https://api.dropboxapi.com/2/files/list_folder/continue';
    const response = await fetch(endpoint, requestOptions);

    const secondData: {
      entries: DataEntry[];
      has_more: boolean;
      cursor?: string;
    } = await response.json();
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status}, endpoint: ${endpoint}`,
      );
    }

    return [
      ...firstData.entries.filter((entry) => entry['.tag'] === 'file'),
      ...secondData.entries.filter((entry) => entry['.tag'] === 'file'),
    ];
  } catch (error) {
    console.error(error);
    return [];
  }
}

const getDropboxMetatag = async (path: string): Promise<any> => {
  const raw = JSON.stringify({
    path: path,
    include_media_info: true,
  });

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: raw,
    redirect: 'follow',
  };
  const endpoint = 'https://api.dropboxapi.com/2/files/get_metadata';
  const response = await fetch(endpoint, requestOptions);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status}, reason: ${data.error_summary}, endpoint: ${endpoint}`,
    );
  }
  return data;
}

const getLocalMetatag = async (path: string) => {
  try {
    const output = await exifr.parse(path);
    const coordsConverter = (coords: number[]) =>
      coords[0] + coords[1] / 60 + coords[2] / 3600;
    let landcscape = true;
    if (output.Orientation.includes('90')) {
      landcscape = false;
    }

    // output =
    // {
    //   Make: 'Apple',
    //   Model: 'iPhone X',
    //   Orientation: 'Rotate 90 CW',
    //   XResolution: 72,
    //   YResolution: 72,
    //   ResolutionUnit: 'inches',
    //   Software: '15.2.1',
    //   ModifyDate: 2022-02-28T00:43:50.000Z,
    //   HostComputer: 'iPhone X',
    //   YCbCrPositioning: 1,
    //   ExposureTime: 0.002570694087403599,
    //   FNumber: 1.8,
    //   ExposureProgram: 'Normal program',
    //   ISO: 20,
    //   ExifVersion: '2.3.2',
    //   DateTimeOriginal: 2022-02-28T00:43:50.000Z,
    //   CreateDate: 2022-02-28T00:43:50.000Z,
    //   OffsetTime: '+09:00',
    //   OffsetTimeOriginal: '+09:00',
    //   OffsetTimeDigitized: '+09:00',
    //   ComponentsConfiguration: Uint8Array(4) [ 1, 2, 3, 0 ],
    //   ShutterSpeedValue: 8.601772231543624,
    //   ApertureValue: 1.6959938128383605,
    //   BrightnessValue: 7.57268397397196,
    //   ExposureCompensation: 0,
    //   MeteringMode: 'Pattern',
    //   Flash: 'Flash did not fire, compulsory flash mode',
    //   FocalLength: 4,
    //   SubjectArea: Uint16Array(4) [ 2015, 1511, 2217, 1330 ],
    //   SubSecTimeOriginal: '026',
    //   SubSecTimeDigitized: '026',
    //   FlashpixVersion: '1.0',
    //   ColorSpace: 65535,
    //   ExifImageWidth: 4032,
    //   ExifImageHeight: 3024,
    //   SensingMethod: 'One-chip color area sensor',
    //   SceneType: 'Directly photographed',
    //   CustomRendered: 'HDR (no original saved)',
    //   ExposureMode: 'Auto',
    //   WhiteBalance: 'Auto',
    //   FocalLengthIn35mmFormat: 28,
    //   SceneCaptureType: 'Standard',
    //   LensInfo: [ 4, 6, 1.8, 2.4 ],
    //   LensMake: 'Apple',
    //   LensModel: 'iPhone X back dual camera 4mm f/1.8',
    //   GPSLatitudeRef: 'N',
    //   GPSLatitude: [ 35, 6, 10.66 ],
    //   GPSLongitudeRef: 'E',
    //   GPSLongitude: [ 139, 4, 39.44 ],
    //   GPSAltitudeRef: Uint8Array(1) [ 0 ],
    //   GPSAltitude: 76.98997874278773,
    //   GPSTimeStamp: '20:0:0',
    //   GPSSpeedRef: 'K',
    //   GPSSpeed: 0,
    //   GPSImgDirectionRef: 'T',
    //   GPSImgDirection: 223.38237011091653,
    //   GPSDestBearingRef: 'True North',
    //   GPSDestBearing: 223.38237011091653,
    //   GPSDateStamp: '2022:02:28',
    //   GPSHPositioningError: 35,
    //   latitude: 35.102961111111114,
    //   longitude: 139.07762222222223
    // }

    return {
      id: path,
      media_info: {
        width: landcscape ? output.ExifImageWidth : output.ExifImageHeight,
        height: landcscape ? output.ExifImageHeight : output.ExifImageWidth,
        orientation: output.Orientation,
        metadata: {
          location: {
            latitude: coordsConverter(output.GPSLatitude),
            longitude: coordsConverter(output.GPSLongitude),
          },
          time_taken: new Date(output.DateTimeOriginal || output.CreateDate || new Date()),
        },
      },
      path_display: path,
    };
  } catch (error) {
    console.log('No metadata for that file... ', error);
    return null;
  }
};

const storeMedia = async (media: MediaDTO) => {
  return await prisma.media.create({ data: media });
}

const storeImage = async(image: ImageDTO) => {
  return await prisma.image.create({ data: image });
}

const getLocalImageBinary = async (mediaPath: string, mediaInfo: any) => {
  try {
    if (!mediaInfo.width || !mediaInfo.height)
      throw new Error(`No width or height for ${mediaPath}`);

    const imageBuffer = fs.readFileSync(mediaPath);
    const largerDimension = Math.max(mediaInfo.width, mediaInfo.height);
    const ratio = largerDimension / 512;
    const resizedBuffer = await resizeImg(imageBuffer, {
      width: mediaInfo.width / ratio,
      height: mediaInfo.height / ratio,
    });

    return resizedBuffer;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const createMedia = async (filePath: string, eventName: string) => {
  if (!eventName) {
    logger('    Missing event, skipping...');
    skippedMedia.eventMissing += 1;
    return;
  }

  const extention = filePath.split('.').pop() ?? '';
  if (
    !['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(extention)
  ) {
    logger('    Not a valid image, skipping...');
    skippedMedia.wrongExtention += 1;
    return;
  }

  let metatag;
  switch (process.env.SOURCE_SERVICE) {
    case 'dropbox':
      metatag = await getDropboxMetatag(filePath);
      break;
    case 'local':
      metatag = await getLocalMetatag(filePath);
      break;
    default:
      break;
  }
  if (!metatag || !metatag.path_display) {
    logger('    No metatag, skipping...');
    skippedMedia.noMetatag += 1;
    return;
  }


  if (metatag?.media_info?.metadata?.location?.latitude === undefined) {
    logger('    No coords, skipping...');
    skippedMedia.coordsMissing += 1;
    return;
  }

  let imageBinary;
  if (process.env.SOURCE_SERVICE === 'dropbox') {
    logger(`    Getting image ${metatag.path_display} from Dropbox...`);
    imageBinary = await getImageBinary(metatag.path_display);
  } else if (process.env.SOURCE_SERVICE === 'local') {
    logger(`    Getting image ${metatag.path_display} from local...`);
    imageBinary = await getLocalImageBinary(metatag.path_display, metatag.media_info);
  }
  logger(`    Got it!`);

  let imageData = null;
  if (process.env.STORAGE_SERVICE === 'cloudinary') {
    logger(`    Uploading image ${metatag.path_display} to Cloudinary...`);
    imageData = await uploadImage(imageBinary);
  } else if (process.env.STORAGE_SERVICE === 'local') {
    logger(`    Uploading image ${metatag.path_display} locally...`);
    imageData = storeLocally(imageBinary);
  } else {
    throw new Error('Unknown storage service');
  }
  if (imageData === null) {
    logger('    No image data, skipping...');
    skippedMedia.noImageData += 1;
    return;
  }
  logger(`    Uploaded!`);

  logger(`    Storing media ${metatag.path_display} in DB)...`);
  const formattedEvent = eventName.match(/[a-zA-Z].*/)?.[0] ?? 'Unkown event';
  const media = await storeMedia({
    dropbox_id: metatag.id,
    path: metatag.path_display,
    date: metatag?.media_info?.metadata?.time_taken,
    latitude: metatag?.media_info?.metadata?.location?.latitude,
    longitude: metatag?.media_info?.metadata?.location?.longitude,
    event: formattedEvent,
  });
  logger(`    Stored!`);

  logger(`    Storing image (public id: ${imageData.public_id} in DB)...`);
  await storeImage({
    mediaId: media.id,
    publicId: imageData.public_id,
    format: imageData.format,
    version: imageData.version,
  });
  logger(`    Stored!`);
  createdMedia += 1;
};

const getSeedsFromDropbox = async (year: string) => {
  // Get every event per year
  const events = await getDropboxResource(`/Photos/${year}`);
  logger(events.entries.length + ` events found for ${year}`);

  for (const [evIndex, event] of (events.entries ?? []).entries()) {
    foundEvent += 1;
    // Get every media per event
    logger(`Event n${evIndex + 1}: ${event.path_display}`);
    const files = await getDropboxFinalResource(event.path_display);
    logger(
      Array.from(files.entries()).length +
        ` files found for ${event.path_display}`,
    );

    for (const [index, file] of files.entries()) {
      foundMedia += 1;
      logger(`  File n${index + 1}: Creating Media for ${file.name}...`);
      await createMedia(file.path_display, event.name);
      logger(`  File n${index + 1}: Finished!\n`);
    }
  }
};

const getSeedsFromLocal = async (year: string) => {
  const basePath = `/Volumes/Raziel/Dropbox/Photos/${year}`;
  // Get every event per year
  const getDirectories = async (source: string) => {
    const allEntities = await readdir(source, { withFileTypes: true });
    return allEntities
      .filter((entity) => entity.isDirectory())
      .map((dirent) => dirent.name);
  };

  const getFiles = async (source: string) => {
    const allEntities = await readdir(source, {
      withFileTypes: true,
      recursive: true,
    });
    return allEntities
      .filter((entity) => !entity.isDirectory())
      .map((file) => file.name);
  };

  const events = await getDirectories(basePath);
  logger(events.length + ` events found for ${year}`);

  for (const [evIndex, event] of events.slice(0, -1).entries()) {
    // Get every media per event
    logger(`Event n${evIndex + 1}: ${event}`);
    const files = await getFiles(`${basePath}/${event}`);
    logger(files.length + ` files found for ${event}`);
    for (const [index, file] of files.slice(0, -1).entries()) {
      logger(`  File n${index + 1}: Creating Media for ${file}...`);
      await createMedia(`${basePath}/${event}/${file}`, event);
      logger(`  File n${index + 1}: Finished!\n`);
    }
  }
};

const main =  async () => {
  logger(`
###################################
Seeding started! (${seedStart})  
###################################
  `);

  if (process.env.SEED_RESET === 'true') {
    logger('Clearing up DB...');
    await resetDb();
    logger('Cleared up!');
  }

  for (const year of ['2022']) {
    if (process.env.SOURCE_SERVICE === 'dropbox') {
      console.log('Getting seeds from Dropbox...');
      await getSeedsFromDropbox(year);
    } else if (process.env.SOURCE_SERVICE === 'local') {
      console.log('Getting seeds from local...');
      await getSeedsFromLocal(year);
    }
  }
  const durationInSeconds = (Date.now() - seedStart.getTime()) / 1000;
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = (durationInSeconds % 60).toFixed(2);

  logger(`
###################################
Found ${foundMedia} medias.
Found ${foundEvent} events.

Created ${createdMedia} medias.
Skipped ${skippedMedia.wrongExtention} medias because not valid image.
Skipped ${skippedMedia.eventMissing} medias because of missing event.
Skipped ${skippedMedia.coordsMissing} medias because of missing coords.
Skipped ${skippedMedia.noImageData} medias because of missing image data.
Skipped ${skippedMedia.noMetatag} medias because of missing metatag.

Seeding duration: ${hours} hours ${minutes} minutes ${seconds} seconds
###################################
    `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
