'use client';

import { useEffect, useState } from 'react';

const EventFilter = ({
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
  const [selectedEvent, setSelectedEvent] = useState('');
  const [events, setEvents] = useState([]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => { 
    const year = events.find( event => event.event === e.target.value ).date.split(" ")[0];
    if (e.target.value === '') {
      setOptions({ ...options, event: undefined });
    } else {
      setOptions({ ...options, year: year, event: e.target.value });
    }
  };

  useEffect(() => {
    const getEvents = async () => {
      const res = await fetch(`/api/get-events`);
      const eventsData = await res.json();
      // console.log(eventsData);
      
      setEvents(eventsData);
    };
    if (events.length === 0 ) getEvents();
    setSelectedEvent(options.event || '');
  }, [options]);

  return (
    <select
      onChange={handleChange}
      id="events"
      className="bg-opacity-70 bg-gray-50 p-2 rounded w-fit text-gray-800"
      value={selectedEvent}
    >
      <option value="">All events</option>
      {events.map((event: { event: string; date: string }) => (
        <option value={event.event} key={event.event}>
          {event.date} - {event.event}
        </option>
      ))}
    </select>
  );
};

export default EventFilter;
