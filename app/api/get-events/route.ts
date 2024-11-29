import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

const getEvents = async ()  => {
  try {
    const events = await prisma.$queryRaw(
      Prisma.sql`
        select event, min(TO_CHAR(date:: DATE, 'yyyy mm dd')) date
        from medias
        group by event
        order by date desc`
    );
    return events;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export async function GET() {
  try {
    const events = await getEvents();
    return NextResponse.json(events);
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Internal server error ${err.message}` },
      { status: 500 },
    );
  }
    

}
