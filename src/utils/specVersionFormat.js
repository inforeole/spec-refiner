const PARIS_TIME_ZONE = 'Europe/Paris';

function parseTimestamp(isoTimestamp) {
    const instant = new Date(isoTimestamp);
    if (Number.isNaN(instant.getTime())) {
        throw new Error('Horodatage de version invalide');
    }
    return instant;
}

function partsByType(formatter, instant) {
    return Object.fromEntries(
        formatter
            .formatToParts(instant)
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    );
}

export function formatSpecTimestamp(isoTimestamp) {
    const instant = parseTimestamp(isoTimestamp);
    const date = new Intl.DateTimeFormat('fr-FR', {
        timeZone: PARIS_TIME_ZONE,
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(instant);
    const time = new Intl.DateTimeFormat('fr-FR', {
        timeZone: PARIS_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).format(instant);

    return {
        date,
        time,
        label: `${date} à ${time}`
    };
}

export function buildSpecFilename(isoTimestamp) {
    const instant = parseTimestamp(isoTimestamp);
    const dateParts = partsByType(new Intl.DateTimeFormat('fr-FR', {
        timeZone: PARIS_TIME_ZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }), instant);
    const timeParts = partsByType(new Intl.DateTimeFormat('fr-FR', {
        timeZone: PARIS_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }), instant);

    return [
        'specifications',
        dateParts.year,
        dateParts.month,
        dateParts.day,
        `${timeParts.hour}${timeParts.minute}`
    ].join('-') + '.docx';
}
