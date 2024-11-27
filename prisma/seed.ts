import { uploadImage } from '../utils/storeOnCloudinary';
import { getImageBinary } from '../utils/getImageBinary';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { readdir } from 'fs/promises';
import { storeLocally } from '../utils/storeLocally';
import exifr from 'exifr';
import resizeImg  from 'resize-img';

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
const skippedMedia = { eventMissing: 0, coordsMissing: 0 };
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

async function getResource(
  path: string,
  recursive?: boolean,
): Promise<{ entries: DataEntry[]; has_more: boolean; cursor?: string }> {
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
}

async function getFinalResource(path: string): Promise<DataEntry[]> {
  try {
    const firstData = await getResource(path, true);
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

async function getMetatag(path: string): Promise<any> {
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
    const coordsConverter = (coords: number[]) => coords[0] + (coords[1] / 60) + (coords[2] / 3600);
    let landcscape = true;
    if (output.Orientation.includes("90")) {
      landcscape = false;
    }
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
          time_taken: new Date(output.DateTimeOriginal),
        },
      },
      path_display: path,
    }
  }
  catch (error) {
    console.log("No metadata for that file... ", error);
    return {};
  }
};

async function storeMedia(media: MediaDTO) {
  return await prisma.media.create({ data: media });
}

async function storeImage(image: ImageDTO) {
  return await prisma.image.create({ data: image });
}

const getLocalImageBinary = async (mediaPath: string, mediaInfo: any) => {
  try {
    if (!mediaInfo.width || !mediaInfo.height)  throw new Error(`No width or height for ${mediaPath}`);
    
    const imageBuffer = fs.readFileSync(mediaPath);
    const largerDimension = Math.max(mediaInfo.width, mediaInfo.height);
    const ratio = largerDimension / 256;
    const resizedBuffer = await resizeImg(imageBuffer, {
      width: mediaInfo.width / ratio,
      height: mediaInfo.height / ratio
  });
  
    return resizedBuffer;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const createMedia = async (filePath: string, eventName: string) => {
  // Get image metatag, and only create Media for the one including coords
  let metatag;
  if (process.env.SOURCE_SERVICE === 'dropbox') {
    metatag = await getMetatag(filePath);
  } else if (process.env.SOURCE_SERVICE === 'local') {
    metatag = await getLocalMetatag(filePath);
  }
  // console.log(metatag);
  
  if (!eventName || !metatag.path_display) {
    logger('    Missing event or path, skipping...');
    skippedMedia.eventMissing += 1;
    return;
  }
  if (metatag?.media_info?.metadata?.location?.latitude === undefined) {
    logger('    No coords, skipping...');
    skippedMedia.coordsMissing += 1;
    return;
  }
  const formattedEvent = eventName.match(/[a-zA-Z].*/)?.[0] ?? 'Unkown event';

  logger(`    Storing media ${metatag.path_display} in DB)...`);
  const media = await storeMedia({
    dropbox_id: metatag.id,
    path: metatag.path_display,
    date: metatag?.media_info?.metadata?.time_taken,
    latitude: metatag?.media_info?.metadata?.location?.latitude,
    longitude: metatag?.media_info?.metadata?.location?.longitude,
    event: formattedEvent,
  });
  logger(`    Stored!`);

  let imageBinary;
  if (process.env.SOURCE_SERVICE === 'dropbox') {
    logger(`    Getting image ${media.path} from Dropbox...`);
    imageBinary = await getImageBinary(media.path);
  } else if (process.env.SOURCE_SERVICE === 'local') {
    logger(`    Getting image ${media.path} from local...`);
    imageBinary = await getLocalImageBinary(media.path, metatag.media_info);
  }
  logger(`    Got it!`);

  let imageData;
  if (process.env.STORAGE_SERVICE === 'cloudinary') {
    logger(`    Uploading image ${media.path} to Cloudinary...`);
    imageData = await uploadImage(imageBinary);
  } else if (process.env.STORAGE_SERVICE === 'local') {
    logger(`    Uploading image ${media.path} locally...`);
    imageData = storeLocally(imageBinary);
  } else {
    throw new Error('Unknown storage service');
  }
  logger(`    Uploaded!`);

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
  const events = await getResource(`/Photos/${year}`);
  logger(events.entries.length + ` events found for ${year}`);

  for (const [evIndex, event] of (events.entries ?? []).entries()) {
    foundEvent += 1;
    // Get every media per event
    logger(`Event n${evIndex + 1}: ${event.path_display}`);
    const files = await getFinalResource(event.path_display);
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

async function main() {
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
Skipped ${skippedMedia.eventMissing} medias because of missing event.
Skipped ${skippedMedia.coordsMissing} medias because of missing coords.

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
