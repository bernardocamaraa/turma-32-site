export function MapEmbed({ height = 320 }: { height?: number }) {
  return (
    <iframe
      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3679.444922756085!2d-43.44945292469434!3d-22.748863979366543!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9967cd5a9cce7d%3A0xfe066c6e8e6fe011!2sBallroom%20Casa%20de%20Festas%20-%20Nova%20Igua%C3%A7u!5e0!3m2!1spt-BR!2sbr!4v1788486944735!5m2!1spt-BR!2sbr"
      title="Mapa do Ballroom Casa de Festas"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      style={{
        width: '100%',
        height,
        border: 0,
        display: 'block',
        filter: 'saturate(.55) brightness(.82) contrast(1.05)',
      }}
    />
  );
}

export const MAPS_LINK = 'https://www.google.com/maps/search/?api=1&query=Ballroom+Casa+de+Festas+Nova+Igua%C3%A7u';
