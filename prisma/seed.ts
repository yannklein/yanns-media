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

async function resetDb() {
  await prisma.image.deleteMany({});
  await prisma.media.deleteMany({});
}

async function getResource(
  path: string,
  recursive?: boolean,
): Promise<{ entries: DataEntry[]; has_more: boolean; cursor?: string }> {
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
  return data;
}

async function getFinalResource(path: string): Promise<DataEntry[]> {
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

  return [
    ...firstData.entries.filter((entry) => entry['.tag'] === 'file'),
    ...secondData.entries.filter((entry) => entry['.tag'] === 'file'),
  ];
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
  return data;
}

async function createMedia(media: MediaDTO) {
  return await prisma.media.create({ data: media });
}

async function main() {
  await resetDb();

  // Get all year folder in Photos
  const yearFolders = await getResource('/Photos');
  yearFolders.entries.slice(28, 29).forEach(async (year: DataEntry) => {
    // Get every event per year
    const eventFolders = await getResource(year.path_display);
    eventFolders.entries.forEach(async (event: DataEntry) => {
      // Get every media per event
      const files = await getFinalResource(event.path_display);
      // console.log(files);
      files.slice(0,10).forEach(async (file: DataEntry) => {
        const metatag = await getMetatag(file.path_display);
        if (!event.name || !metatag.path_display) {
          console.log(metatag);
        }
        if (metatag?.media_info?.metadata?.location?.latitude !== undefined) {
          const media = await createMedia({
            dropbox_id: metatag.id,
            path: metatag.path_display,
            date: metatag?.media_info?.metadata?.time_taken,
            latitude: metatag?.media_info?.metadata?.location?.latitude,
            longitude: metatag?.media_info?.metadata?.location?.longitude,
            event: event.name,
          });
          console.log(media.path);
          const imageBinary = await getImageBinary(media.path);
          console.log("binary caught")
          const imageData: any = await uploadImage(imageBinary);
          console.log("data uploaded", imageData)

          await prisma.image.create({
            data: {
              publicId: imageData.public_id,
              format: imageData.format,
              version: imageData.version.toString(),
              mediaId: media.id,
            },
          });
        }
      });
    });
  });
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
