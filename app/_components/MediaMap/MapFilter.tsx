'use client';

import { useEffect, useState } from "react";
import YearFilter from "./YearFilter";
import EventFilter from "./EventFilter";
import PersonFilter from "./PersonFilter";

const MapFilter = ({
  getMedias,
}: {
  getMedias: ({
    person,
    year,
    event,
    id,
  }: {
    person?: string;
    year?: string;
    event?: string;
    id?: string;
  }) => void;
}) => {

  const [options, setOptions] = useState({});
 
  useEffect(() => {    
    getMedias(options);
  }, [options]);

  return (
    <div className="absolute top-24 left-8 z-10 flex flex-col items-baseline gap-1">
      <div className="flex gap-1">
        <EventFilter options={options} setOptions={setOptions} />
        <YearFilter options={options} setOptions={setOptions} />
        <PersonFilter options={options} setOptions={setOptions} />
        <button className="bg-signature-gradient bg-opacity-80 border-2 px-2 py-1 rounded min-w-fit" onClick={() => setOptions({})}>Reset</button>
      </div>
    </div>
  );
};

export default MapFilter;
