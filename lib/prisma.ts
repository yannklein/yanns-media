import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  let globalWithPrisma = global as typeof globalThis & {
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
          return `https://res.cloudinary.com/yanninthesky/image/upload/v${image.version}/${image.publicId}.${image.format}`;
        },
      },
    },
  },
});


export default prismaExtended;
