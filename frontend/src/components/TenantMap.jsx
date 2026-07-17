import { Link } from 'react-router-dom';

const TenantMap = ({ company }) => {
  const lat = parseFloat(company?.latitude);
  const lng = parseFloat(company?.longitude);
  const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasCoords) {
    return (
      <div className="card tenant-map-card">
        <h3>Company Location</h3>
        <p className="tenant-map-empty">
          No map location set yet. Add latitude and longitude in{' '}
          <Link to="/tenant/company">Company Profile</Link> to show your business on the map.
        </p>
        {company?.address && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Address on file: {company.address}
          </p>
        )}
      </div>
    );
  }

  const delta = 0.012;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <div className="card tenant-map-card">
      <h3>Company Location</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
        {company?.company_name}{company?.address ? ` — ${company.address}` : ''}
      </p>
      <iframe
        title="Company location map"
        className="tenant-map-frame"
        src={mapSrc}
        loading="lazy"
      />
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="tenant-map-link"
      >
        Open in OpenStreetMap
      </a>
    </div>
  );
};

export default TenantMap;
