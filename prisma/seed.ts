import { uploadImage } from '../utils/storeOnCloudinary';
import { getImageBinary } from '../utils/getImageBinary';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { storeLocally } from '../utils/storeLocally';

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

async function storeMedia(media: MediaDTO) {
  return await prisma.media.create({ data: media });
}

async function storeImage(image: ImageDTO) {
  return await prisma.image.create({ data: image });
}

const createMedia = async (file: DataEntry, event: DataEntry) => {
  // Get image metatag, and only create Media for the one including coords
  const metatag = await getMetatag(file.path_display);
  if (!event.name || !metatag.path_display) {
    logger('    Missing event or path, skipping...');
    skippedMedia.eventMissing += 1;
    return;
  }
  if (metatag?.media_info?.metadata?.location?.latitude === undefined) {
    logger('    No coords, skipping...');
    skippedMedia.coordsMissing += 1;
    return;
  }
  const formattedEvent = event.name.match(/[a-zA-Z].*/)?.[0] ?? 'Unkown event';

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

  logger(`    Getting image ${media.path} from Dropbox...`);
  const imageBinary = await getImageBinary(media.path);
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

async function main() {
  logger(`
###################################
Seeding started! (${seedStart})  
###################################
  `);

  logger('Clearing up DB...');
  await resetDb();
  logger('Cleared up!');

  for (const year of ['2023']) {
    // Get every event per year
    const events = await getResource(`/Photos/${year}`);
    logger(events.entries.length + ` events found for ${year}`);

    for (const [evIndex, event] of Array.from(
      (events.entries ?? []).entries(),
    ).slice(0, 1)) {
      foundEvent += 1;
      // Get every media per event
      logger(`Event n${evIndex + 1}: ${event.path_display}`);
      const files = await getFinalResource(event.path_display);

      for (const [index, file] of files.entries()) {
        foundMedia += 1;
        logger(`  File n${index + 1}: Creating Media for ${file.name}...`);
        await createMedia(file, event);
        logger(`  File n${index + 1}: Finished!\n`);
      }
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
