import { Prisma } from "@prisma/client";
import { GeoJSONFeature } from "mapbox-gl";

export type ImageProps = {
  id: string;
  publicId: string;
  format: string;
  version: number;
  mediaId: string;
  clPath: string;
};

export type MediaWithImages ={
  id: string;
  createdAt: Date;
  updatedAt: Date;
  dropbox_id: string;
  path: string;
  date: Date | null;
  latitude: number | null;
  longitude: number | null;
  event: string | null;
  images: ImageProps[];
}


export interface MapGLGeoJSONFeature extends GeoJSONFeature {
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}
