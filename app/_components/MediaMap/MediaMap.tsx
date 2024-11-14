'use client';
import { useCallback, useRef } from 'react';
import RmglInteractiveMap, { Layer, Source } from 'react-map-gl';

import 'mapbox-gl/dist/mapbox-gl.css';
import { Media, Prisma } from '@prisma/client';
import type { GeoJSONSource, MapMouseEvent, MapRef } from 'react-map-gl';
import {
  clusterLayer,
  clusterCountLayer,
  unclusteredPointLayer,
} from './layers';
import { GeoJSONFeature } from 'mapbox-gl';
import bbox from '@turf/bbox';

interface MapGLGeoJSONFeature extends GeoJSONFeature {
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

type MediaWithImages = Prisma.MediaGetPayload<{
  include: { images: true }
}>

export const MediaMap = ({
  medias,
  accessToken,
}: {
  medias: MediaWithImages[];
  accessToken: string;
}) => {
  const mapRef = useRef<MapRef>(null);
  const geojson = {
    type: 'FeatureCollection',
    features: medias
      .filter(
        (media): media is MediaWithImages & { latitude: number; longitude: number } =>
          media.latitude !== null && media.longitude !== null,
      )
      .map((media) => ({
        type: 'Feature',
        properties: { mediaId: media.images[0].id },
        geometry: {
          type: 'Point',
          coordinates: [
            media.longitude || 0 + (Math.random() - 0.5) / 1000,
            media.latitude + (Math.random() - 0.5) / 1000,
          ],
        },
      })),
  };
  const [minLng, minLat, maxLng, maxLat] = bbox(geojson as any);

  const onClick = (event: MapMouseEvent) => {
    if (!event || !event.features) return;
    const feature = event.features[0] as MapGLGeoJSONFeature;

    const clusterId = feature?.properties?.cluster_id;
    if (mapRef.current === null || clusterId === undefined) return;

    const mapboxSource = mapRef.current.getSource('medias') as GeoJSONSource;

    mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || mapRef.current === null) {
        return;
      }

      mapRef.current.easeTo({
        center: feature.geometry.coordinates,
        zoom: zoom as number,
        duration: 500,
      });
    });
  };

  const mapRefCallback = useCallback(
    (ref: MapRef | null) => {
      if (ref !== null) {
        //Set the actual ref we use elsewhere
        mapRef.current = ref;
        const map = ref;

        const loadImages = () => {
          medias.forEach((media) => {
            if (media.images.length === 0) return;

            if (!map.hasImage(media.images[0].id)) {
              console.log(media.images[0].id, imageSrc(media.images[0]));
              //NOTE This is really how are you load an SVG for mapbox
              let img = new Image();
              img.crossOrigin = 'Anonymous'; //it's not cross origin, but this quiets the canvas error
              img.onload = () => {
                map.addImage(media.images[0].id, img, { sdf: false });
              };
              img.src = imageSrc(media.images[0]);

              //NOTE ref for adding local image instead
              // map.loadImage("./static/img/shop-15.png", (error, image) => {
              //   if (error || image === undefined) throw error;
              //   map.addImage("store-icon", image, { sdf: true });
              // });
            }
          });
        };

        const loadImage = (id) => {
          const media = medias.find((media) => media.images[0].id === id);
          if (!media || media.images.length === 0) return;
          if (!map.hasImage(media.images[0].id)) {
            console.log(media.images[0].id, imageSrc(media.images[0]));
            //NOTE This is really how are you load an SVG for mapbox
            let img = new Image();
            img.crossOrigin = 'Anonymous'; //it's not cross origin, but this quiets the canvas error
            img.onload = () => {
              map.addImage('hi', img, { sdf: false });
            };
            img.src = imageSrc(media.images[0]);

            //NOTE ref for adding local image instead
            // map.loadImage("./static/img/shop-15.png", (error, image) => {
            //   if (error || image === undefined) throw error;
            //   map.addImage("store-icon", image, { sdf: true });
            // });
          }
        };

        loadImages();

        //TODO need this?
        map.on('styleimagemissing', (e) => {
          const id = e.id; // id of the missing image
          console.log(id);
          loadImage(id);
        });
      }
    },
    [medias],
  );

  const imageSrc = (image: any) => {
    if (!image) return '';
    return `https://res.cloudinary.com/yanninthesky/image/upload/v${image.version}/${image.publicId}.${image.format}`;
  };

  return (
    <>
      <RmglInteractiveMap
        initialViewState={{
          bounds: [minLng, minLat, maxLng, maxLat],
          fitBoundsOptions: {
            padding: {
              top: 120,
              bottom: 120,
              left: 120,
              right: 120,
            },
          },
        }}
        mapStyle={'mapbox://styles/mapbox/streets-v9'}
        style={{ width: '100vw', height: '600px' }}
        mapboxAccessToken={accessToken}
        interactiveLayerIds={[clusterLayer.id as string]}
        onClick={onClick}
        ref={mapRefCallback}
      >
        <Source
          id="medias"
          type="geojson"
          data={geojson}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>
      </RmglInteractiveMap>
    </>
  );
};
