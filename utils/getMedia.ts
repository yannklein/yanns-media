import prisma from '@/lib/prisma';

const getMedia = async ({year, event} : {year?: string, event?: string})  => {
  try {
    const medias = await prisma.media.findMany({
      where: {
        latitude: {
          not: null
        },
        longitude: {
          not: null
        },
        date: {
          gte: year ? new Date(`${year}-01-01`) : undefined,
          lte: year ? new Date(`${year}-12-31`) : undefined,
        },
        event: {
          contains: event ? event : undefined,
        },
      },
      include: {
        images: true
      },
    });    
    return medias;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export { getMedia };
