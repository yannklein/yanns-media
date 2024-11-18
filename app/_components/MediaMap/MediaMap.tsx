'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import RmglInteractiveMap, { Layer, Source } from 'react-map-gl';
import type { GeoJSONSource, MapMouseEvent, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import bbox from '@turf/bbox';

import {
  clusterLayer,
  clusterCountLayer,
  unclusteredPointLayer,
} from './layers';

import { ImageDetailsPopup } from './ImageDetailsPopup';
import { MediaWithImages, MapGLGeoJSONFeature } from '@/app/types';

export const MediaMap = ({ accessToken, initialMedias }: { accessToken: string, initialMedias: MediaWithImages[] }) => {
  
  const mapRef = useRef<MapRef>(null);
  const [medias, setMedias] = useState<MediaWithImages[]>(initialMedias);
  const [selectedMedia, setSelectedMedia] = useState<MediaWithImages>(medias[0]);
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);
  
  const getMedias = async ({ year, event }: { year: string; event: string } = { year: '', event: '' }) => {
    const res = await fetch(`/api/get-medias`, {
      method: 'POST',
      body: JSON.stringify({ year, event }),
    });
    const medias =  await res.json()
    setMedias(medias)
  };

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: medias
      .map((media) => ({
        type: 'Feature',
        properties: { mediaId: media.images[0]?.id, mediaEvent: media.event, mediaDate: media.date },
        geometry: {
          type: 'Point',
          coordinates: [
            media.longitude || 0 + (Math.random() - 0.5) / 1000,
            media.latitude || 0 + (Math.random() - 0.5) / 1000,
          ],
        },
      })),
  };
  const [minLng, minLat, maxLng, maxLat] = bbox(geojson);

  const zoomInCluster = (clusterId: number, feature: MapGLGeoJSONFeature) => {
    if (mapRef.current === null) return;
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

  const onClick = (event: MapMouseEvent) => {
    if (!event || !event.features) return;
    const feature = event.features[0] as MapGLGeoJSONFeature;
    
    // close popup if click on empty space on the map    
    if (feature === undefined) {
      setShowDetailsPopup(false);
      getMedias();
      return;
    }
    
    const clusterId = feature?.properties?.cluster_id;    

    if (clusterId !== undefined) {
      // it's a cluster
      zoomInCluster(clusterId, feature);
    } else {
      // it's a photo
      
      const mediaEvent = feature?.properties?.mediaEvent;    
      setShowDetailsPopup(true);
      const clickedMedia = medias.find((media) => media.images[0]?.id === feature?.properties?.mediaId)
      if (clickedMedia) {
        setSelectedMedia(clickedMedia);
        getMedias({ event: mediaEvent, year: '' });
      }
    }
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
            const image = media.images[0];

            if (!map.hasImage(image.id)) {
              //NOTE This is really how are you load an SVG for mapbox
              let img = new Image();
              img.crossOrigin = 'Anonymous'; //it's not cross origin, but this quiets the canvas error
              img.onload = () => {
                map.addImage(image.id, img, { sdf: false });
              };
              img.src = image.clPath;
            }
          });
        };

        const loadImage = (id: string) => {
          const media = medias.find((media) => media.images[0].id === id);
          if (!media || media?.images?.length === 0) return;
          const image = media.images[0];

          if (!map.hasImage(image.id)) {
            //NOTE This is really how are you load an SVG for mapbox
            let img = new Image();
            img.crossOrigin = 'Anonymous'; //it's not cross origin, but this quiets the canvas error
            img.onload = () => {
              map.addImage(image.id, img, { sdf: false });
            };
            img.src = image.clPath;
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

  return (
    <>
      <ImageDetailsPopup selectedMedia={selectedMedia} show={showDetailsPopup} medias={medias} />
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
        style={{ width: '100vw', height: 'inherit', flexGrow: 1 }}
        mapboxAccessToken={accessToken}
        interactiveLayerIds={[clusterLayer.id as string, unclusteredPointLayer.id as string]}
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
