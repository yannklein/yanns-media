import { uploadImage } from '../utils/cloudinary';
import { getImageBinary } from '../utils/getImageBinary';
import { PrismaClient } from '@prisma/client';
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

async function resetDb() {
  await prisma.image.deleteMany({});
  await prisma.media.deleteMany({});
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
      throw new Error(`HTTP error! status: ${response.status}, reason: ${data.error_summary}, endpoint: ${endpoint}`);
    }
    return data;
  } catch (error) {
    console.log(error);
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
      throw new Error(`HTTP error! status: ${response.status}, endpoint: ${endpoint}`);
    }

    return [
      ...firstData.entries.filter((entry) => entry['.tag'] === 'file'),
      ...secondData.entries.filter((entry) => entry['.tag'] === 'file'),
    ];
  } catch (error) {
    console.log(error);
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
    throw new Error(`HTTP error! status: ${response.status}, reason: ${data.error_summary}, endpoint: ${endpoint}`);
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
    console.log("Missing event or path, skipping...");
    return;
  }
  if (metatag?.media_info?.metadata?.location?.latitude === undefined) {
    console.log("No coords, skipping...");
    return;
  }

  console.log(`Storing media ${metatag.path_display} in DB)...`);
  const media = await storeMedia({
    dropbox_id: metatag.id,
    path: metatag.path_display,
    date: metatag?.media_info?.metadata?.time_taken,
    latitude: metatag?.media_info?.metadata?.location?.latitude,
    longitude: metatag?.media_info?.metadata?.location?.longitude,
    event: event.name,
  });
  console.log(`Stored!`);

  console.log(`Getting image ${media.path} from Dropbox...`);
  const imageBinary = await getImageBinary(media.path);
  console.log(`Got it!`);

  console.log(`Uploading image ${media.path} to Cloudinary...`);
  const imageData = await uploadImage(imageBinary);
  console.log(`Uploaded!`);

  console.log(`Storing image (public id: ${imageData.public_id} in DB)...`);
  await storeImage({
    mediaId: media.id,
    publicId: imageData.public_id,
    format: imageData.format,
    version: imageData.version,
  });
  console.log(`Stored!`);
};

async function main() {
  await resetDb();

  for (let year of ['2023']) {
    // Get every event per year
    const events = await getResource(`/Photos/${year}`);
    
    for (let event of events.entries ?? []) {
      // Get every media per event
      const files = await getFinalResource(event.path_display);

      for (let file of files) {
        console.log(`Creating Media for ${file.name}...`);
        await createMedia(file, event);
        console.log(`Created!`);
      }
    }
  }
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
