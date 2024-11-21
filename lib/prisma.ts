import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  const globalWithPrisma = global as typeof globalThis & {
    prisma: PrismaClient;
  };
  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient();
  }
  prisma = globalWithPrisma.prisma;
}

const prismaExtended = prisma.$extends({
  result: {
    image: {
      clPath: {
        needs: { version: true, publicId: true, format: true },
        compute(image) {
          if (process.env.STORAGE_SERVICE === 'local') {
            return "/" + encodeURIComponent(image.publicId);
          } else if (process.env.STORAGE_SERVICE === 'cloudinary') {
            return `https://res.cloudinary.com/yanninthesky/image/upload/v${image.version}/${image.publicId}.${image.format}`;
          } else {
            throw new Error('Unknown storage service');
          }
        },
      },
    },
  },
});

export default prismaExtended;
