import prisma from '@/lib/prisma';
import { MediaMap } from '@components/MediaMap';

export default async function Home() {
  const medias = await prisma.media.findMany({
    include: {
      images: true,
    },
  });
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN as string;

  
  return (
    <div>
      <MediaMap
        medias={medias}
        accessToken={accessToken}
      />
    </div>
  );
}
