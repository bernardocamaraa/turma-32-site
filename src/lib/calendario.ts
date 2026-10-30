/**
 * The night as a calendar event (.ics), for the "Adicionar ao calendário"
 * button: the phone opens it in its calendar app. Times are written in UTC
 * so they land right wherever the guest is: 19h in Brasília is 22h UTC.
 * There's no official end time, so the event is set to five hours.
 */
const EVENTO = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Turma 32//Baile de formatura//PT',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'BEGIN:VEVENT',
  'UID:baile-turma-32-20261210@turma32',
  'DTSTAMP:20261001T000000Z',
  'DTSTART:20261210T220000Z',
  'DTEND:20261211T030000Z',
  'SUMMARY:Baile de formatura da Turma 32',
  'LOCATION:Ballroom Casa de Festas\\, Nova Iguaçu',
  'DESCRIPTION:Convidados a partir das 19h. Traje: passeio completo.',
  'BEGIN:VALARM',
  'TRIGGER:-P1D',
  'ACTION:DISPLAY',
  'DESCRIPTION:Amanhã é o baile da Turma 32',
  'END:VALARM',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

export function baixarEventoDoBaile() {
  const url = URL.createObjectURL(new Blob([EVENTO], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'baile-turma-32.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
