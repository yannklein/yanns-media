import { MediaWithImages } from '@/app/types';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const getAssociatedMedias = async (id: number) => {
  let imagePath;
  if (process.env.STORAGE_SERVICE === 'local') {
    imagePath = Prisma.sql`"images"."publicId"`;
  } else if (process.env.STORAGE_SERVICE === 'cloudinary') {
    imagePath = Prisma.sql`
      CONCAT(
        'https://res.cloudinary.com/yanninthesky/image/upload/v',
        "images".version, '/',
        "images"."publicId", '.',
        "images".format
      )`;
  } else {
    throw new Error('Unknown storage service');
  }
  const query = Prisma.sql`
      WITH reference_location AS (
        SELECT 
          ST_MakePoint(longitude, latitude)::geography AS location,
          date_part('year', date) as year,
          event
        FROM "medias"
        WHERE id = ${id}
      )
      SELECT *,
            ST_Distance(
              ST_MakePoint(longitude, latitude)::geography,
              (SELECT location FROM reference_location)
            ) AS distance,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', "images".id,
                  'publicId', "images"."publicId",
                  'format', "images".format,
                  'version', "images".version,
                  'mediaId', "images"."mediaId",
                  'clPath', ${imagePath}
                )
              ) FILTER (WHERE "images".id IS NOT NULL),
              '[]'
            ) AS images
      FROM "medias"
      JOIN "images" ON "medias"."id" = "images"."mediaId"
      where true
        and date_part('year', date) = (SELECT year FROM reference_location)
        and event = (SELECT event FROM reference_location)
      GROUP BY "medias"."id", "images"."id"
      ORDER BY distance ASC
      LIMIT 32
      `;
  
  return await prisma.$queryRaw<MediaWithImages[]>(query);
};

export async function POST(req: NextRequest) {
  try {
    const params = await req.json();
    // console.log({ params });

    if (params.id) {
      const medias = await getAssociatedMedias(params.id);
      return NextResponse.json(medias);
    }

    const medias = await prisma.media.findMany({
      where: {
        latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
        date: {
          gte: params.year ? new Date(`${params.year}-01-01`) : undefined,
          lte: params.year ? new Date(`${params.year}-12-31`) : undefined,
        },
        event: {
          contains: params.event ? params.event : undefined,
        },
      },
      include: {
        images: true,
      },
    });

    return NextResponse.json(medias);
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Internal server error ${err.message}` },
      { status: 500 },
    );
  }
}
