const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:bFxmfDRTinQeiQiaIREXZNfcvrarsigQ@turntable.proxy.rlwy.net:21963/railway' } }
});

(async () => {
  const events = await prisma.event.count();
  const externalEvents = await prisma.externalEvent.count();
  const artists = await prisma.artist.count();
  const users = await prisma.user.count();
  const publishedEvents = await prisma.event.count({ where: { status: 'PUBLISHED' } });
  const upcomingExternal = await prisma.externalEvent.count({ where: { eventDate: { gte: new Date() } } });

  console.log('Events (internal):', events);
  console.log('  Published:', publishedEvents);
  console.log('External Events:', externalEvents);
  console.log('  Upcoming:', upcomingExternal);
  console.log('Artists:', artists);
  console.log('Users:', users);

  // Check a sample of external events
  const sample = await prisma.externalEvent.findMany({
    take: 5,
    orderBy: { eventDate: 'asc' },
    where: { eventDate: { gte: new Date() } },
    select: { title: true, artistName: true, venueName: true, venueCity: true, eventDate: true, status: true, importedEventId: true }
  });
  console.log('\nSample upcoming external events:');
  sample.forEach(e => console.log(`  ${e.artistName} - ${e.title} @ ${e.venueName}, ${e.venueCity} (${e.eventDate.toISOString().slice(0,10)}) [${e.status}] imported=${e.importedEventId || 'no'}`));

  // Check if events page uses external events or internal
  const importedCount = await prisma.externalEvent.count({ where: { status: 'IMPORTED' } });
  const publishedExtCount = await prisma.externalEvent.count({ where: { status: 'PUBLISHED' } });
  console.log('\nExternal events by status:');
  console.log('  IMPORTED:', importedCount);
  console.log('  PUBLISHED:', publishedExtCount);

  // Check remaining artists with events
  const artistsWithEvents = await prisma.artist.findMany({
    where: { events: { some: {} } },
    select: { stageName: true, _count: { select: { events: true } } }
  });
  console.log('\nArtists with internal events:', artistsWithEvents.length);
  artistsWithEvents.forEach(a => console.log(`  ${a.stageName}: ${a._count.events} events`));

  await prisma.$disconnect();
})();
