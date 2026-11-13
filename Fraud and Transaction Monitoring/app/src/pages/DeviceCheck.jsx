import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { startEmbeddedDevice } from '../services/onesdk';
import Logo from '../components/Logo';

/**
 * /device-check/:entityId — a test page, not part of the customer journey.
 * Loads embedded OneSDK's device module for one person and lists what it
 * reports, so the result can be compared with that person's fraud workflow.
 */
export default function DeviceCheck() {
  const { entityId } = useParams();
  const [events, setEvents] = useState([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode mounts twice
    started.current = true;
    const log = (name, payload) => {
      console.log('[DeviceCheck]', name, payload);
      setEvents((e) => [...e, { name, at: new Date().toLocaleTimeString(), detail: payload ? JSON.stringify(payload).slice(0, 160) : '' }]);
    };
    startEmbeddedDevice(entityId, log).catch((err) => log('failed', { message: err.message }));
  }, [entityId]);

  const done = events.some((e) => e.name === 'completed' || e.name === 'device_characteristics_extracted');
  const failed = events.some((e) => /failed|error/i.test(e.name));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-5">
        <div className="mb-4"><Logo size="sm" /></div>
        <h1 className="text-lg font-semibold text-gray-900">
          {done ? 'Device check complete' : failed ? 'Device check failed' : 'Checking your device…'}
        </h1>
        <p className="text-xs text-gray-500 mb-4 break-all">Embedded OneSDK test · {entityId}</p>
        <ul className="space-y-1.5">
          {events.map((e, i) => (
            <li key={i} className="text-xs">
              <span className="text-gray-400">{e.at}</span>{' '}
              <span className="font-medium text-gray-800">{e.name}</span>
              {e.detail && <div className="text-gray-500 break-all">{e.detail}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
