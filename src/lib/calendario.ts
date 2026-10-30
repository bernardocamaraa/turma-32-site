/**
 * The night as a calendar event, for the "save the date" buttons. Times are
 * in UTC so they land right wherever the guest is: 19h in Brasília is 22h
 * UTC. There's no official end time, so the event is set to five hours.
 *
 * - Google Calendar: a link that opens its "new event" screen filled in.
 * - Apple (and Outlook): the .ics file in public/, served as text/calendar
 *   (see vercel.json), which an iPhone or a Mac opens as "add to calendar".
 *   If the night's details change, change them there too.
 */
const TITULO = 'Baile de formatura da Turma 32';
const LOCAL = 'Ballroom Casa de Festas, Nova Iguaçu';
const DETALHES = 'Convidados a partir das 19h. Traje: passeio completo.';

export const LINK_GOOGLE_AGENDA =
  'https://calendar.google.com/calendar/render?' +
  new URLSearchParams({
    action: 'TEMPLATE',
    text: TITULO,
    dates: '20261210T220000Z/20261211T030000Z',
    location: LOCAL,
    details: DETALHES,
  }).toString();

export const EVENTO_ICS = '/baile-turma-32.ics';
