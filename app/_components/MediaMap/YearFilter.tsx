'use client';

import { useEffect, useState } from 'react';

const YearFilter = ({
  options,
  setOptions,
}: {
  options: {
    year?: string;
    event?: string;
    id?: string;
  };
  setOptions: ({
    year,
    event,
    id,
  }: {
    year?: string;
    event?: string;
    id?: string;
  }) => void;
}) => {
  const [selectedYear, setSelectedYear] = useState('');
  const [years, setYears] = useState([]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOptions({ ...options, year: e.target.value || undefined, event: undefined });
  };

  useEffect(() => {
    const getYears = async () => {
      const res = await fetch(`/api/get-years`);
      const yearsData = await res.json();
      setYears(yearsData.map((item: { year: string }) => item.year));
    };    
    if (years.length === 0) getYears();
    setSelectedYear(options.year || '');
  }, [options]);

  return (
    <select
      onChange={handleChange}
      id="years"
      className="bg-opacity-70 bg-gray-50 p-2 rounded min-w-fit text-gray-800"
      value={selectedYear}
    >
      <option value="">All years</option>
      {years.map((year) => (
        <option value={year} key={year}>
          {year}
        </option>
      ))}
    </select>
  );
};

export default YearFilter;
