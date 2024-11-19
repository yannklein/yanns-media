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

import { ImageDetailsPopup } from '../ImageDetailsPopup';
import { MediaWithImages, MapGLGeoJSONFeature } from '@/app/types';
import Supercluster, { PointFeature } from 'supercluster';

export const MediaMap = ({ accessToken, initialMedias }: { accessToken: string, initialMedias: MediaWithImages[] }) => {
  
  const mapRef = useRef<MapRef>(null);
  const [medias, setMedias] = useState<MediaWithImages[]>(initialMedias);
  const [selectedMedia, setSelectedMedia] = useState<MediaWithImages | null>(null);
  const [showDetailsPopup, setShowDetailsPopup] = useState(false);

  // Super cluster used to dig into clusters
  const clusterRadius = 50;
  const clusterMaxZoom = 14;
  const superCluster = new Supercluster({
      radius: clusterRadius,
      maxZoom: clusterMaxZoom
    });
  
  useEffect(() => {
      getMedias({ id: selectedMedia?.id });
  }, [selectedMedia]);

  const getMedias = async ({ year, event, id }: { year?: string; event?: string, id?: string }) => {
    // if no filters, load initial medias
    if(!year && !event && !id) {
      setMedias(initialMedias); 
      return;
    }
    // else, fetch filtered medias
    const res = await fetch(`/api/get-medias`, {
      method: 'POST',
      body: JSON.stringify({ year, event, id }),
    });
    const medias = await res.json()
    console.log("New medias fetched:", medias.length);
    
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

  // Load medias geo data to supercluster
  superCluster.load(geojson.features as PointFeature<GeoJSONSource>[]);


  const [minLng, minLat, maxLng, maxLat] = bbox(geojson);

  const zoomInCluster = (clusterId: number, feature: MapGLGeoJSONFeature) => {
    const map = mapRef.current;
    if (map === null) return;
    const mapboxSource = map.getSource('medias') as GeoJSONSource;

    const clusterChildren = superCluster.getLeaves(clusterId, Infinity);
    // only preload images when clicking on cluster of more than 100 images
    if (clusterChildren.length < 100) {
      clusterChildren.forEach((clusterChild) => {
        const imageId = clusterChild.properties.mediaId;
        if (map.hasImage(imageId)) return;
        const media = medias.find((media) => media.images[0]?.id === imageId);
        
        if (!media) return;
        let img = new Image();
        img.crossOrigin = 'Anonymous'; //it's not cross origin, but this quiets the canvas error
        img.src = media?.images[0].clPath as string;
        
        img.onload = () => {
          // map.removeImage(imageId as string);
          map.addImage(imageId as string, img);
        };
      })
    }
    

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

  const onMapClick = (event: MapMouseEvent) => {
    if (!event || !event.features) return;
    const feature = event.features[0] as MapGLGeoJSONFeature;
    
    // close popup if click on empty space on the map    
    if (feature === undefined) {
      setShowDetailsPopup(false);
      setSelectedMedia(null);
      return;
    }
    
    const clusterId = feature?.properties?.cluster_id;    

    if (clusterId !== undefined) {
      // it's a cluster, zoom in
      zoomInCluster(clusterId, feature);
    } else {
      // it's a photo, show popup
      setShowDetailsPopup(true);
      const clickedMedia = medias.find((media) => media.images[0]?.id === feature?.properties?.mediaId)
      if (clickedMedia) {
        setSelectedMedia(clickedMedia);
        console.log({selectedMedia});
      }
    }
  };

  // const mapRefCallback = useCallback(    
  //   (ref: MapRef | null) => {
  //     if (ref !== null) {
  //       //Set the actual ref we use elsewhere
  //       mapRef.current = ref;
  //       const map = ref;

  //       const loadImages = () => {
  //         console.log("Loading images:", medias.length);
  //         medias.forEach((media) => {
  //           if (media.images.length === 0) return;
  //           const image = media.images[0];

  //           if (!map.hasImage(image.id)) {
  //             //NOTE This is really how are you load an SVG for mapbox
  //             let img = new Image();
  //             img.crossOrigin = 'Anonymous'; //it's not cross origin, but this quiets the canvas error
  //             img.onload = () => {
  //               map.addImage(image.id, img, { sdf: false });
  //             };
  //             if (initialMedias.length === medias.length) {
  //               img.src = '/tube-spinner.svg' //image.clPath
  //             } else {
  //               img.src = image.clPath
  //             }
  //           }
  //         });
  //       };
  //       // loadImages();
  //     }
  //   },
  //   [],
  // );

  return (
    <>
    { showDetailsPopup && (
      <ImageDetailsPopup selectedMedia={selectedMedia} medias={medias} />
    )}
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
        onClick={onMapClick}
        // ref={mapRefCallback}
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
