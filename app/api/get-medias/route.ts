import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  
  try {
    const { year, event } = await req.json();    
    const medias = await prisma.media.findMany({
      where: {
        latitude: {
          not: null
        },
        longitude: {
          not: null
        },
        date: {
          gte: year ? new Date(`${year}-01-01`) : undefined,
          lte: year ? new Date(`${year}-12-31`) : undefined,
        },
        event: {
          contains: event,
        },
      },
      include: {
        images: true
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

