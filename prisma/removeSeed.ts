import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const getMedia = async ({ year, event }: { year?: string; event?: string }) => {
  try {
    const medias = await prisma.media.findMany({
      where: {
        latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
        path: {
          contains: `/Photos/${year ? year : ''}/`,
        },
        event: {
          contains: event ? event : undefined,
        },
      },
      include: {
        images: true,
      },
    });
    return medias;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const removeSeed = async ({
  year,
  event,
}: {
  year?: string;
  event?: string;
}) => {
  const medias = await getMedia({ year, event });

  for (const media of medias) {    
    try {
      const mediaPath = media?.images[0]?.publicId;
      if (!mediaPath) {
        console.log('No image path found for ${media.path} ');
      } else {
        fs.unlink("/public" + mediaPath, (err) => {
          if (err) {
            console.log(`${mediaPath} was NOT deleted.`);
            return;
          }
          console.log(`${mediaPath} was deleted.`);
        });
      }

      await prisma.image.deleteMany({
        where: {
          mediaId: media.id,
        },
      });

      await prisma.media.delete({
        where: {
          id: media.id,
        },
      });
      console.log(`the media ${media.path} was deleted.`);
    } catch (error) {
      console.log(error);
    }
  }
};

removeSeed({ year: '2022' });
