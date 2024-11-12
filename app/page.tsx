import prisma from '@/lib/prisma';
import { MediaMap } from '@components/MediaMap';

export default async function Home() {
  const medias = await prisma.media.findMany();
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN as string; 

  return (
    <div>
      <MediaMap medias={medias} accessToken={accessToken} />
    </div>
  );
}
