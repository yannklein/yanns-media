'use client';

import { MediaWithImages } from '@/app/types';

export const ImageDetailsPopup = ({
  show = false,
  medias,
}: {
  show?: boolean;
  medias: MediaWithImages[];
}) => {
  if (show) {
    return (
      <div className="fixed z-10 p-10 -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 w-3/4 h-3/4 shadow-2xl bg-white">
        {medias.map((media) => (
          <div key={media.id}>
            <h2>{media.event}</h2>
            <h3>{media.date?.toString()}</h3>
            {/* <img src={media.images[0].clPath} alt={media.images[0].id} /> */}
          </div>
        ))}
      </div>
    );
  }
};
