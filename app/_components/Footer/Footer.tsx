import Link from "next/link";


export const Footer: React.FC = () => {
  return (
    <footer className="bg-cream font-heading drop-shadow-top h-28 flex">
      <div className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex flex-col lg:flex-row lg:space-x-6">
          <Link href="#">Map</Link>
          <Link href="#">List</Link>
        </div>
        <div>
          Created with <span className="">❤️</span> by Yann
        </div>
      </div>
    </footer>
  );
}
