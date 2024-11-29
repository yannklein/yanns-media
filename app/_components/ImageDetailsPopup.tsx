'use client';
import { MediaWithImages } from '@/app/types';

export const ImageDetailsPopup = ({
  selectedMedia,
  medias,
}: {
  selectedMedia?: MediaWithImages | null;
  medias: MediaWithImages[];
}) => {
  const formattedDate = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(date));

    return (
      <div className="fixed z-10 p-10 -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 w-3/4 h-3/4 shadow-2xl bg-white overflow-scroll">
        <div className='flex justify-between items-end mb-3'>
          <h1 className='text-3xl text-center'>{selectedMedia?.event}</h1>
          <h2 className='text-xl text-center'>{formattedDate(selectedMedia?.date as Date)}</h2>
        </div>
        <div className="grid grid-cols-5 gap-4 overflow-scroll">
          <img
            className="aspect-square min-h-[100%] min-w-[100%] w-[100%] h-[100%] object-cover col-span-2 row-span-2"
            src={selectedMedia?.images[0].clPath}
            alt={selectedMedia?.images[0].id}
          />
          {medias.slice(1)
            .filter((media) => media.images.length > 0)
            .map((media) => (
              <img
                className="aspect-square min-h-[100%] min-w-[100%] w-[100%] h-[100%] object-cover"
                src={medias.length > 34 ? '/tube-spinner.svg' : media.images[0].clPath}
                alt={media.images[0].id}
                key={media.images[0].id}
              />
            ))}
        </div>
      </div>
    );
};
