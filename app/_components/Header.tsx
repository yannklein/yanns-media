'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Image from 'next/image';

const Header: React.FC = () => {
  const isActive: (pathname: string) => boolean = (pathname) =>
    usePathname() === pathname;

  return (
    <nav>
      <div
        className={`bg-signature-gradient flex items-center justify-center md:justify-between drop-shadow-2xl w-full py-3 px-5 font-heading gap-3`}
      >
        <Link
          href="/"
          className={`flex lg:gap-3 items-center`}
          data-active={isActive('/')}
        >
          <h1 className="ml-3 lg:ml-5 text-5xl font-bold text-slate-100 drop-shadow-sharp">
            Yann's media
          </h1>
        </Link>
        <div className="gap-3 hidden sm:flex">
          <Link href="/projects" className="text-2xl">
            Map
          </Link>
          <Link href="/about" className="text-2xl">
            List
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Header;
