import type { LayerProps } from 'react-map-gl';

export const clusterLayer: LayerProps = {
  id: 'clusters',
  type: 'circle',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#F8CDDA',
      100,
      '#c371d6',
      750,
      '#6979b9',
    ],
    'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
  },
};

export const clusterCountLayer: LayerProps = {
  id: 'cluster-count',
  type: 'symbol',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12,
  },
};

export const unclusteredPointLayer: LayerProps = {
  id: 'unclustered-point',
  // type: 'circle',
  filter: ['!', ['has', 'point_count']],
  type: 'symbol',
  source: 'points', // reference the data source
  layout: {
    'icon-image': ['get', 'mediaId'], // reference the image
    'icon-size': 0.25,
  },
};
