import { getMedia } from '@/utils/getMedia';
import { MediaMap } from '@components/MediaMap';

export default async function Home() {
  const medias = await getMedia();
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN as string;
  
  return (
    <div className="flex-grow flex">
      <MediaMap
        initialMedias={JSON.parse(JSON.stringify(medias))}
        accessToken={accessToken}
      />
    </div>
  );
}
