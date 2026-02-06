import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.raffleEntry.deleteMany();
  await prisma.rafflePool.deleteMany();
  await prisma.poolTicket.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.event.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hash('password123', 10);

  // Create artist user
  const artistUser = await prisma.user.create({
    data: {
      email: 'artist@example.com',
      passwordHash,
      name: 'DJ Nova',
      role: 'ARTIST',
      lat: 40.7128,
      lng: -74.006,
      city: 'New York',
    },
  });

  const artist = await prisma.artist.create({
    data: {
      userId: artistUser.id,
      stageName: 'DJ Nova',
      genre: 'Electronic',
      bio: 'NYC-based electronic music producer',
    },
  });

  // Create fan users
  const fan = await prisma.user.create({
    data: {
      email: 'fan@example.com',
      passwordHash,
      name: 'Alex Fan',
      role: 'FAN',
      lat: 34.0522,
      lng: -118.2437,
      city: 'Los Angeles',
    },
  });

  const localFan = await prisma.user.create({
    data: {
      email: 'localfan@example.com',
      passwordHash,
      name: 'Jordan Local',
      role: 'LOCAL_FAN',
      lat: 40.73,
      lng: -73.99,
      city: 'New York',
    },
  });

  // Create event
  const event = await prisma.event.create({
    data: {
      artistId: artist.id,
      title: 'Nova Nights: NYC Edition',
      description: 'An unforgettable night of electronic music in the heart of NYC.',
      venueName: 'Webster Hall',
      venueAddress: '125 E 11th St, New York, NY 10003',
      venueLat: 40.7326,
      venueLng: -73.9895,
      venueCity: 'New York',
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
      ticketPriceCents: 5000,
      totalTickets: 500,
      localRadiusKm: 50,
      status: 'PUBLISHED',
    },
  });

  // Create raffle pool (single $5 tier for MVP)
  await prisma.rafflePool.create({
    data: {
      eventId: event.id,
      tierCents: 500,
      status: 'OPEN',
      scheduledDrawTime: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seed complete:', {
    artistUser: artistUser.email,
    fan: fan.email,
    localFan: localFan.email,
    event: event.title,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
