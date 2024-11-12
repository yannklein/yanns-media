'use client';
import {useRef} from 'react';
import Map, { Layer, Source } from 'react-map-gl';

import 'mapbox-gl/dist/mapbox-gl.css';
import { Media } from '@prisma/client';
import type {GeoJSONSource, MapRef} from 'react-map-gl';
import {clusterLayer, clusterCountLayer, unclusteredPointLayer} from './layers';


export const MediaMap = ({ medias, accessToken }: { medias: Media[], accessToken: string }) => {
  const mapStyle = 'mapbox://styles/mapbox/streets-v9';


  const mapRef = useRef<MapRef>(null);

  const onClick = (event: any) => {
    const feature = event.features[0];
    const clusterId = feature.properties.cluster_id;
    if (mapRef.current === null) return;

    const mapboxSource = mapRef.current.getSource('earthquakes') as GeoJSONSource;

    mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err || mapRef.current === null) {
        return;
      }

      mapRef.current.easeTo({
        center: feature.geometry.coordinates,
        zoom: zoom as number,
        duration: 500
      });
    });
  };

  const geojson = {
    type: 'FeatureCollection',
    features: medias.map((media) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [media.longitude, media.latitude]
      }
    }))
  };

  return (
    <>
      <Map
        initialViewState={{
          latitude: 40.67,
          longitude: -103.59,
          zoom: 3
        }}
        mapStyle={mapStyle}
        style={{width: "100vw", height: "600px"}}
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
}
