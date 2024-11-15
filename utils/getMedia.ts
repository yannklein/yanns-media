import prisma from '@/lib/prisma';

const getMedia = async (year: string = '', event: string = '')  => {
  try {
    const medias = await prisma.media.findMany({
      where: {
        date: {
          gte: year ? new Date(`${year}-01-01`) : undefined,
          lte: year ? new Date(`${year}-12-31`) : undefined,
        },
        event: {
          contains: event,
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
