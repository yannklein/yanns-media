'use client';
import { useRef } from 'react';
import Map, { Layer, Source } from 'react-map-gl';

import 'mapbox-gl/dist/mapbox-gl.css';
import { Media } from '@prisma/client';
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

export const MediaMap = ({
  medias,
  accessToken,
}: {
  medias: Media[];
  accessToken: string;
}) => {
  const mapStyle = 'mapbox://styles/mapbox/streets-v9';
  const mapRef = useRef<MapRef>(null);

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

  const geojson = {
    type: 'FeatureCollection',
    features: medias.map((media) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [media.longitude, media.latitude],
      },
    })),
  };

  const [minLng, minLat, maxLng, maxLat] = bbox(geojson as GeoJSON.GeoJSON);

  return (
    <>
      <Map
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
        mapStyle={mapStyle}
        style={{ width: '100vw', height: '600px' }}
        mapboxAccessToken={accessToken}
        interactiveLayerIds={[clusterLayer.id as string]}
        onClick={onClick}
        ref={mapRef}
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
      </Map>
    </>
  );
};
