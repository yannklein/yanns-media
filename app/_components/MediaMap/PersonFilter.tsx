'use client';

import { useEffect, useState } from 'react';

type Person = {
  id: string;
  name: string;
};

const PersonFilter = ({
  options,
  setOptions,
}: {
  options: {
    person?: string;
    year?: string;
    event?: string;
    id?: string;
  };
  setOptions: ({
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
  const [selectedPerson, setSelectedPerson] = useState('');
  const [persons, setPersons] = useState<Person[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOptions({ ...options, person: e.target.value || undefined, event: undefined });
  };

  useEffect(() => {
    const getPersons = async () => {
      const res = await fetch(`/api/get-persons`);
      const personsData = await res.json();
      setPersons(personsData);
    };    
    if (persons.length === 0) getPersons();
    setSelectedPerson(options.person || '');
  }, [options]);

  return (
    <select
      onChange={handleChange}
      id="persons"
      className="bg-opacity-70 bg-gray-50 p-2 rounded min-w-fit text-gray-800"
      value={selectedPerson}
    >
      <option value="">All persons</option>
      {persons.map((person) => (
        <option value={person.id} key={person.id}>
          {person.name === 'unknown' ? person.id : person.name}
        </option>
      ))}
    </select>
  );
};

export default PersonFilter;
