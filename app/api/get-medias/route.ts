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
    console.log({ params });

    if (params.id) {
      const medias = await getAssociatedMedias(params.id);
      return NextResponse.json(medias);
    }

    let queryConditions = `
      WHERE m.latitude IS NOT NULL
        AND m.longitude IS NOT NULL
    `;

    let additionalJoins = '';

    if (params.year) {
      queryConditions += `
      AND m.date >= '${params.year}-01-01'
      AND m.date <= '${params.year}-12-31'
      `;
    }

    if (params.event) {
      queryConditions += ` AND m.event ILIKE '${params.event}'`;
    }

    if (params.person) {
      additionalJoins = `
        JOIN person_on_images poi ON i.id = poi."imageId"
        JOIN persons p ON p.id = poi."personId"
      `;
      queryConditions += `
        AND p.id = '${params.person}'
      `;
    }

    let imagePath;
    if (process.env.STORAGE_SERVICE === 'local') {
      imagePath = `i."publicId"`;
    } else if (process.env.STORAGE_SERVICE === 'cloudinary') {
      imagePath = `
      CONCAT(
        'https://res.cloudinary.com/yanninthesky/image/upload/v',
        i.version, '/',
        i."publicId", '.',
        i.format
      )`;
    } else {
      throw new Error('Unknown storage service');
    }

    const rawQuery = `
      SELECT 
        m.*,
        json_agg(json_build_object(
          'id', i.id,
          'publicId', i."publicId",
          'format', i.format,
          'version', i.version,
          'mediaId', i."mediaId",
          'clPath', ${imagePath}
        )) AS images
      FROM medias m
      JOIN images i ON m.id = i."mediaId"
      ${additionalJoins}
      ${queryConditions}
      GROUP BY m.id;
    `;

    const medias = await prisma.$queryRawUnsafe(rawQuery);

    return NextResponse.json(medias);
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Internal server error ${err.message}` },
      { status: 500 },
    );
  }
}
