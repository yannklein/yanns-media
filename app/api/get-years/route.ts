import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

const getYears = async ()  => {
  try {
    const years = await prisma.$queryRaw(
      Prisma.sql`
        select date_part('year', date) as year
        from medias
        group by year`
    );
    return years;
  } catch (error) {
    console.log(error);
    return [];
  }
};

export async function GET() {
  try {
    const years = await getYears();
    return NextResponse.json(years);
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Internal server error ${err.message}` },
      { status: 500 },
    );
  }
    

}
