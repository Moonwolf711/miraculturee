import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

// Venue coordinates for known venues (approximate)
const VENUE_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
  // NYC
  'Brooklyn Hangar': { lat: 40.6782, lng: -73.9442, city: 'Brooklyn, NY' },
  'Marquee': { lat: 40.7484, lng: -73.9967, city: 'New York, NY' },
  '99 Scott': { lat: 40.7053, lng: -73.9367, city: 'Brooklyn, NY' },
  'Elsewhere': { lat: 40.7024, lng: -73.9214, city: 'Brooklyn, NY' },
  'Sultan Room': { lat: 40.7045, lng: -73.9207, city: 'Brooklyn, NY' },
  'Public Records': { lat: 40.6838, lng: -73.9886, city: 'Brooklyn, NY' },
  'Knockdown Center': { lat: 40.7107, lng: -73.9138, city: 'Queens, NY' },
  'Terminal 5': { lat: 40.7713, lng: -73.9991, city: 'New York, NY' },
  'Brooklyn Steel': { lat: 40.7191, lng: -73.9344, city: 'Brooklyn, NY' },
  'Brooklyn Paramount': { lat: 40.6896, lng: -73.9784, city: 'Brooklyn, NY' },
  'Nebula': { lat: 40.7414, lng: -73.9872, city: 'New York, NY' },
  'H0L0': { lat: 40.7282, lng: -73.9249, city: 'Queens, NY' },
  'Signal Brooklyn': { lat: 40.7089, lng: -73.9367, city: 'Brooklyn, NY' },
  'SILO Brooklyn': { lat: 40.6946, lng: -73.9336, city: 'Brooklyn, NY' },
  'Blue Note Jazz Club': { lat: 40.7312, lng: -74.0005, city: 'New York, NY' },
  'Somewhere Nowhere': { lat: 40.7484, lng: -74.0024, city: 'New York, NY' },
  // LA
  'Avalon Hollywood': { lat: 34.1012, lng: -118.3252, city: 'Los Angeles, CA' },
  'The Observatory': { lat: 33.7454, lng: -117.8675, city: 'Santa Ana, CA' },
  'Sound Nightclub': { lat: 34.0906, lng: -118.3298, city: 'Los Angeles, CA' },
  'Exchange LA': { lat: 34.0453, lng: -118.2514, city: 'Los Angeles, CA' },
  'Academy LA': { lat: 34.0416, lng: -118.2501, city: 'Los Angeles, CA' },
  'Time Nightclub': { lat: 33.6804, lng: -117.9066, city: 'Costa Mesa, CA' },
  '1720': { lat: 34.0336, lng: -118.2320, city: 'Los Angeles, CA' },
  'Hollywood Palladium': { lat: 34.0984, lng: -118.3247, city: 'Los Angeles, CA' },
  'The Novo': { lat: 34.0443, lng: -118.2669, city: 'Los Angeles, CA' },
  'The Wiltern': { lat: 34.0621, lng: -118.3093, city: 'Los Angeles, CA' },
  'Kia Forum': { lat: 33.9583, lng: -118.3420, city: 'Inglewood, CA' },
  'Regent Theater': { lat: 34.0639, lng: -118.2404, city: 'Los Angeles, CA' },
  'Zebulon': { lat: 34.0858, lng: -118.2109, city: 'Los Angeles, CA' },
  'Echoplex': { lat: 34.0782, lng: -118.2607, city: 'Los Angeles, CA' },
  'Roxy Theatre Hollywood': { lat: 34.0901, lng: -118.3869, city: 'West Hollywood, CA' },
  'LA State Historic Park': { lat: 34.0647, lng: -118.2278, city: 'Los Angeles, CA' },
  'The Spotlight': { lat: 34.0934, lng: -118.3296, city: 'Los Angeles, CA' },
  'Lot 613': { lat: 34.0394, lng: -118.2358, city: 'Los Angeles, CA' },
  // Chicago
  'Radius': { lat: 41.8544, lng: -87.6324, city: 'Chicago, IL' },
  'Cermak Hall at Radius': { lat: 41.8544, lng: -87.6324, city: 'Chicago, IL' },
  'Sound Bar Chicago': { lat: 41.8930, lng: -87.6312, city: 'Chicago, IL' },
  'Smartbar': { lat: 41.9523, lng: -87.6604, city: 'Chicago, IL' },
  'Concord Music Hall': { lat: 41.9171, lng: -87.7087, city: 'Chicago, IL' },
  'The Salt Shed': { lat: 41.8743, lng: -87.6559, city: 'Chicago, IL' },
  'Prysm': { lat: 41.8925, lng: -87.6272, city: 'Chicago, IL' },
  'Spybar': { lat: 41.8922, lng: -87.6312, city: 'Chicago, IL' },
  'Metro Chicago': { lat: 41.9497, lng: -87.6599, city: 'Chicago, IL' },
  'The Outset': { lat: 41.8900, lng: -87.6298, city: 'Chicago, IL' },
  'Chop Shop Chicago': { lat: 41.9190, lng: -87.6749, city: 'Chicago, IL' },
  'TAO Chicago': { lat: 41.8929, lng: -87.6265, city: 'Chicago, IL' },
  'Vic Theatre': { lat: 41.9531, lng: -87.6516, city: 'Chicago, IL' },
  'Ramova Theatre': { lat: 41.8366, lng: -87.6329, city: 'Chicago, IL' },
  // Miami
  'Club Space': { lat: 25.7955, lng: -80.1869, city: 'Miami, FL' },
  'E11EVEN': { lat: 25.7808, lng: -80.1970, city: 'Miami, FL' },
  'LIV Miami': { lat: 25.8000, lng: -80.1233, city: 'Miami Beach, FL' },
  'Do Not Sit On The Furniture': { lat: 25.7897, lng: -80.1359, city: 'Miami Beach, FL' },
  'Floyd': { lat: 25.7956, lng: -80.1898, city: 'Miami, FL' },
  'Kemistry': { lat: 26.1206, lng: -80.1376, city: 'Fort Lauderdale, FL' },
  'DAER Nightclub': { lat: 26.0523, lng: -80.2104, city: 'Davie, FL' },
  'Virginia Key Beach Park': { lat: 25.7387, lng: -80.1503, city: 'Miami, FL' },
  'Mana Wynwood Convention Center': { lat: 25.7967, lng: -80.2027, city: 'Miami, FL' },
  'ZeyZey Miami': { lat: 25.7878, lng: -80.1915, city: 'Miami, FL' },
  'Palm Tree Club Miami': { lat: 25.8447, lng: -80.1575, city: 'North Bay Village, FL' },
  'North Beach Bandshell': { lat: 25.8672, lng: -80.1213, city: 'Miami Beach, FL' },
  // Denver
  'Mission Ballroom': { lat: 39.7719, lng: -104.9804, city: 'Denver, CO' },
  'The Church Nightclub': { lat: 39.7311, lng: -104.9863, city: 'Denver, CO' },
  'Club Vinyl': { lat: 39.7370, lng: -104.9987, city: 'Denver, CO' },
  'Club Vinyl Basement': { lat: 39.7370, lng: -104.9987, city: 'Denver, CO' },
  'Cervantes\' Masterpiece Ballroom': { lat: 39.7607, lng: -104.9802, city: 'Denver, CO' },
  'The Black Box': { lat: 39.7384, lng: -104.9992, city: 'Denver, CO' },
  'Summit Music Hall Denver': { lat: 39.7417, lng: -104.9915, city: 'Denver, CO' },
  'Ogden Theatre': { lat: 39.7406, lng: -104.9750, city: 'Denver, CO' },
  'Bluebird Theater': { lat: 39.7375, lng: -104.9614, city: 'Denver, CO' },
  'Meow Wolf Denver': { lat: 39.7741, lng: -104.9743, city: 'Denver, CO' },
  'Temple Denver': { lat: 39.7508, lng: -104.9994, city: 'Denver, CO' },
  'Fillmore Auditorium': { lat: 39.7484, lng: -104.9750, city: 'Denver, CO' },
  'ReelWorks Denver': { lat: 39.7571, lng: -104.9860, city: 'Denver, CO' },
  // Atlanta
  'Believe Music Hall': { lat: 33.8486, lng: -84.3733, city: 'Atlanta, GA' },
  'Ravine Atlanta': { lat: 33.7756, lng: -84.3717, city: 'Atlanta, GA' },
  'District Atlanta': { lat: 33.7599, lng: -84.4122, city: 'Atlanta, GA' },
  'Tabernacle Atlanta': { lat: 33.7588, lng: -84.3916, city: 'Atlanta, GA' },
  'Aisle 5': { lat: 33.7480, lng: -84.3541, city: 'Atlanta, GA' },
  'Terminal West': { lat: 33.8035, lng: -84.4127, city: 'Atlanta, GA' },
  'The Eastern': { lat: 33.7550, lng: -84.3579, city: 'Atlanta, GA' },
  // San Francisco
  'The Midway': { lat: 37.7468, lng: -122.3965, city: 'San Francisco, CA' },
  'Public Works': { lat: 37.7651, lng: -122.4166, city: 'San Francisco, CA' },
  'Audio SF': { lat: 37.7678, lng: -122.4105, city: 'San Francisco, CA' },
  'The Great Northern': { lat: 37.7683, lng: -122.4178, city: 'San Francisco, CA' },
  'Bill Graham Civic Auditorium': { lat: 37.7784, lng: -122.4176, city: 'San Francisco, CA' },
  'Halcyon SF': { lat: 37.7695, lng: -122.4118, city: 'San Francisco, CA' },
  '1015 Folsom': { lat: 37.7776, lng: -122.4048, city: 'San Francisco, CA' },
  'The Regency Ballroom': { lat: 37.7872, lng: -122.4211, city: 'San Francisco, CA' },
  // Austin
  'Kingdom Austin': { lat: 30.2656, lng: -97.7358, city: 'Austin, TX' },
  'Concourse Project': { lat: 30.2370, lng: -97.7095, city: 'Austin, TX' },
  'Cedar Street Courtyard': { lat: 30.2682, lng: -97.7421, city: 'Austin, TX' },
  'Emo\'s Austin': { lat: 30.2635, lng: -97.7319, city: 'Austin, TX' },
  'Stubb\'s BBQ Waller Creek Amphitheater': { lat: 30.2685, lng: -97.7350, city: 'Austin, TX' },
  // Las Vegas
  'Zouk Nightclub': { lat: 36.1268, lng: -115.1686, city: 'Las Vegas, NV' },
  'XS Nightclub': { lat: 36.1267, lng: -115.1666, city: 'Las Vegas, NV' },
  'Hakkasan': { lat: 36.1024, lng: -115.1728, city: 'Las Vegas, NV' },
  'Omnia': { lat: 36.1162, lng: -115.1742, city: 'Las Vegas, NV' },
  'Marquee Las Vegas': { lat: 36.1058, lng: -115.1730, city: 'Las Vegas, NV' },
  'EDC Las Vegas Motor Speedway': { lat: 36.2722, lng: -115.0107, city: 'Las Vegas, NV' },
  'Illenium at Resorts World': { lat: 36.1268, lng: -115.1686, city: 'Las Vegas, NV' },
  // Detroit
  'Magic Stick': { lat: 42.3469, lng: -83.0563, city: 'Detroit, MI' },
  'TV Lounge': { lat: 42.3315, lng: -83.0779, city: 'Detroit, MI' },
  'Spot Lite': { lat: 42.3348, lng: -83.0593, city: 'Detroit, MI' },
  'The Masonic Temple': { lat: 42.3379, lng: -83.0575, city: 'Detroit, MI' },
  'Marble Bar': { lat: 42.3358, lng: -83.0604, city: 'Detroit, MI' },
  'Leland City Club': { lat: 42.3460, lng: -83.0557, city: 'Detroit, MI' },
  // Seattle
  'Showbox SoDo': { lat: 47.5818, lng: -122.3338, city: 'Seattle, WA' },
  'Kremwerk': { lat: 47.6145, lng: -122.3375, city: 'Seattle, WA' },
  'Monkey Loft': { lat: 47.5811, lng: -122.3437, city: 'Seattle, WA' },
  'Neumos': { lat: 47.6148, lng: -122.3211, city: 'Seattle, WA' },
  'The Showbox': { lat: 47.6083, lng: -122.3402, city: 'Seattle, WA' },
  'Neptune Theatre': { lat: 47.6617, lng: -122.3141, city: 'Seattle, WA' },
  // DC
  'Echostage': { lat: 38.9207, lng: -76.9728, city: 'Washington, DC' },
  'Soundcheck': { lat: 38.9198, lng: -76.9739, city: 'Washington, DC' },
  'Flash DC': { lat: 38.9138, lng: -77.0229, city: 'Washington, DC' },
  'The Anthem': { lat: 38.8782, lng: -77.0233, city: 'Washington, DC' },
  '9:30 Club': { lat: 38.9179, lng: -77.0238, city: 'Washington, DC' },
  // Philadelphia
  'NOTO': { lat: 39.9624, lng: -75.1623, city: 'Philadelphia, PA' },
  'The Brooklyn Bowl Philadelphia': { lat: 39.9512, lng: -75.1367, city: 'Philadelphia, PA' },
  'Franklin Music Hall': { lat: 39.9639, lng: -75.1356, city: 'Philadelphia, PA' },
  'The Fillmore Philadelphia': { lat: 39.9644, lng: -75.1318, city: 'Philadelphia, PA' },
};

// Parsed events from EDM Train scrape
interface RawEvent {
  artists: string;
  venue: string;
  city: string;
  date: string;
  ageRestriction?: string;
  type?: 'SHOW' | 'FESTIVAL';
}

function parseEvents(): RawEvent[] {
  const events: RawEvent[] = [
    // === NEW YORK CITY ===
    { artists: 'Spring Festival - Lunar New Year: Porter Robinson, Wavedash, Hoodini, Jokah, Gianni Glo', venue: 'Brooklyn Hangar', city: 'Brooklyn, NY', date: '2026-02-14', type: 'FESTIVAL' },
    { artists: 'VAVO', venue: 'Marquee', city: 'New York, NY', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'CID', venue: '99 Scott', city: 'Brooklyn, NY', date: '2026-04-25', ageRestriction: '21+' },
    { artists: 'Wilkinson, Yetti, Johnny Mahon, Nate Band', venue: 'Elsewhere', city: 'Brooklyn, NY', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'Random Rab, New Thousand', venue: 'Sultan Room', city: 'Brooklyn, NY', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'Nastia Reigel, Daiyah, 1morning', venue: 'Public Records', city: 'Brooklyn, NY', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'Frederic', venue: 'Marquee', city: 'New York, NY', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'Teletech: Azyr b2b blk., Fantasm, Hannah Laing, JSMN, KLOFAMA, Trym', venue: 'Brooklyn Storehouse', city: 'Brooklyn, NY', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'Ray Volpe, Virtual Riot, EDDIE', venue: 'Terminal 5', city: 'New York, NY', date: '2026-02-07', ageRestriction: '18+' },
    { artists: 'ALLEYCVT, Zen Selekta, Cozy Kev', venue: 'Brooklyn Steel', city: 'Brooklyn, NY', date: '2026-02-07', ageRestriction: '18+' },
    { artists: 'Habstrakt, Asdek, Ultra', venue: 'Elsewhere', city: 'Brooklyn, NY', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'Liu', venue: 'Nebula', city: 'New York, NY', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'Kölsch, Brina Knauss', venue: 'Superior Ingredients (Rooftop)', city: 'Brooklyn, NY', date: '2026-02-08', ageRestriction: '21+' },
    { artists: 'Loud Luxury', venue: 'Marquee', city: 'New York, NY', date: '2026-02-13', ageRestriction: '21+' },
    { artists: 'RUSH: Héctor Oaks, Estella Boersma, BAUGRUPPE90', venue: 'Knockdown Center', city: 'Queens, NY', date: '2026-02-13' },
    { artists: 'Monolink, Catching Flies', venue: 'Brooklyn Paramount', city: 'Brooklyn, NY', date: '2026-02-14' },
    { artists: 'Port Zero Tour: INFEKT, Bommer, Usaybflow, Electric Dad', venue: 'SILO Brooklyn', city: 'Brooklyn, NY', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'Horse Meat Disco, The Illustrious Blacks, Dangerous Rose', venue: 'Knockdown Center', city: 'Queens, NY', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'Boys Noize, Juliana Huxtable, Katie Rex, ISAbella', venue: 'BASEMENT NY', city: 'Queens, NY', date: '2026-02-14' },
    { artists: 'Madeon', venue: 'Marquee', city: 'New York, NY', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'Spring Festival: Alan Walker, Mike Posner, KUPYD, Cyberpunk', venue: 'Brooklyn Hangar', city: 'Brooklyn, NY', date: '2026-02-15', ageRestriction: '21+', type: 'FESTIVAL' },
    { artists: 'Louie Vega, Lisa Fischer', venue: 'Blue Note Jazz Club', city: 'New York, NY', date: '2026-02-19' },
    { artists: 'Sonny Fodera', venue: 'Victory Hall Outdoors', city: 'Brooklyn, NY', date: '2026-06-05' },
    { artists: 'Romare', venue: 'Public Records', city: 'Brooklyn, NY', date: '2026-02-12', ageRestriction: '21+' },
    // === LOS ANGELES ===
    { artists: 'INFEKT, MUST DIE!, Codd Dubz', venue: 'The Observatory', city: 'Santa Ana, CA', date: '2026-02-06', ageRestriction: '18+' },
    { artists: 'CamelPhat, Kotiēr', venue: 'Reframe Studios Indoors', city: 'Los Angeles, CA', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'G Jones b2b Eprom, Ivy Lab', venue: 'The Bellwether', city: 'Los Angeles, CA', date: '2026-02-06' },
    { artists: 'Angerfist', venue: 'Academy LA', city: 'Los Angeles, CA', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'Wilkinson', venue: 'Avalon Hollywood', city: 'Los Angeles, CA', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'INFEKT, Phiso', venue: 'The Observatory', city: 'Santa Ana, CA', date: '2026-02-07', ageRestriction: '18+' },
    { artists: 'The Martinez Brothers, Bontan', venue: 'Reframe Studios Indoors', city: 'Los Angeles, CA', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'DIESEL (Shaquille O\'Neal)', venue: 'Avalon Hollywood', city: 'Los Angeles, CA', date: '2026-02-12', ageRestriction: '21+' },
    { artists: 'Jan Blomqvist, Nico De Andrea, MAXI MERAKI, Yulia Niko', venue: 'Reframe Studios Indoors', city: 'Los Angeles, CA', date: '2026-02-13', ageRestriction: '21+' },
    { artists: 'Catz \'n Dogz', venue: 'Sound Nightclub', city: 'Los Angeles, CA', date: '2026-02-13', ageRestriction: '21+' },
    { artists: 'Kaivon, St. Mary', venue: 'Echoplex', city: 'Los Angeles, CA', date: '2026-02-14', ageRestriction: '18+' },
    { artists: 'DJ Cassidy', venue: 'Kia Forum', city: 'Inglewood, CA', date: '2026-02-14' },
    { artists: 'HoneyLuv', venue: 'Sound Nightclub', city: 'Los Angeles, CA', date: '2026-02-15', ageRestriction: '21+' },
    { artists: 'Fox Stevenson', venue: 'Regent Theater', city: 'Los Angeles, CA', date: '2026-02-20' },
    { artists: 'Snow Strippers, EVILGIANE, EERA, PZ\'', venue: 'Hollywood Palladium', city: 'Los Angeles, CA', date: '2026-02-20', ageRestriction: '18+' },
    { artists: 'Craze, The Gaslamp Killer, Four Color Zack', venue: 'The Novo', city: 'Los Angeles, CA', date: '2026-02-20' },
    { artists: 'The Parallel Spirits Tour: LEVEL UP, Zingara, Jkyl & Hyde, Osyris', venue: 'Hollywood Palladium', city: 'Los Angeles, CA', date: '2026-02-21' },
    { artists: 'ATB', venue: 'Academy LA', city: 'Los Angeles, CA', date: '2026-02-21', ageRestriction: '21+' },
    { artists: 'Deorro', venue: 'Avalon Hollywood', city: 'Los Angeles, CA', date: '2026-02-21', ageRestriction: '21+' },
    { artists: 'Gorillaz', venue: 'Hollywood Palladium', city: 'Los Angeles, CA', date: '2026-02-22' },
    { artists: 'Monolink, Parallelle', venue: 'The Wiltern', city: 'Los Angeles, CA', date: '2026-02-27' },
    { artists: 'VNSSA', venue: 'Sound Nightclub', city: 'Los Angeles, CA', date: '2026-02-27', ageRestriction: '21+' },
    { artists: 'Chris Lake, Hot Since 82, Clüb De Combat', venue: 'LA State Historic Park', city: 'Los Angeles, CA', date: '2026-06-20' },
    { artists: 'Gareth Emery', venue: 'Avalon Hollywood', city: 'Los Angeles, CA', date: '2026-03-14', ageRestriction: '21+' },
    { artists: 'Sven Väth World Tour', venue: 'Lot 613', city: 'Los Angeles, CA', date: '2026-03-07' },
    // === CHICAGO ===
    { artists: 'North Coast Music Festival: GRiZ, Ganja White Night, Fisher, SLANDER', venue: 'SeatGeek Stadium', city: 'Bridgeview, IL', date: '2026-09-04', type: 'FESTIVAL' },
    { artists: 'Beyond Wonderland Chicago: Marshmello, James Hype, Alan Walker, Dombresky', venue: 'Huntington Bank Pavilion', city: 'Chicago, IL', date: '2026-06-06', ageRestriction: '18+', type: 'FESTIVAL' },
    { artists: 'AR/CO', venue: 'Sound Bar Chicago', city: 'Chicago, IL', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'KUKO, Fatima Hajji, Aiden, hhunter', venue: 'Cermak Hall at Radius', city: 'Chicago, IL', date: '2026-02-06', ageRestriction: '18+' },
    { artists: 'The Blessed Madonna, Harry Cross', venue: 'Smartbar', city: 'Chicago, IL', date: '2026-02-06' },
    { artists: 'The Warehouse Initiative: MK, Goosey, Gianni Keys', venue: 'Cermak Hall at Radius', city: 'Chicago, IL', date: '2026-02-07' },
    { artists: 'Space 92, BRKN', venue: 'Prysm', city: 'Chicago, IL', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'Port Zero Tour: INFEKT, MUST DIE!, Phiso, Bommer', venue: 'Ramova Theatre', city: 'Chicago, IL', date: '2026-02-13', ageRestriction: '18+' },
    { artists: 'Opiuo, rSUN', venue: 'The Outset', city: 'Chicago, IL', date: '2026-02-13', ageRestriction: '18+' },
    { artists: 'Mahmut Orhan', venue: 'Concord Music Hall', city: 'Chicago, IL', date: '2026-02-13', ageRestriction: '18+' },
    { artists: 'DJ Minx, Shaun J. Wright', venue: 'Smartbar', city: 'Chicago, IL', date: '2026-02-13' },
    { artists: 'Taiki Nulight, Casey Club', venue: 'Concord Music Hall', city: 'Chicago, IL', date: '2026-02-14' },
    { artists: 'Desert Hearts, Mikey Lion, Lee Reynolds, Marbs', venue: 'Smoke & Mirrors', city: 'Chicago, IL', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'Ray Volpe, Samplifire, TYNAN, EDDIE', venue: 'Radius', city: 'Chicago, IL', date: '2026-02-21', ageRestriction: '18+' },
    { artists: 'Massano', venue: 'Concord Music Hall', city: 'Chicago, IL', date: '2026-02-21', ageRestriction: '18+' },
    { artists: 'Monolink, Parallelle', venue: 'Vic Theatre', city: 'Chicago, IL', date: '2026-02-18', ageRestriction: '18+' },
    { artists: 'Synapse Tour: Wooli, ProbCause, HURTBOX, MACHAKI', venue: 'The Salt Shed', city: 'Chicago, IL', date: '2026-02-20' },
    { artists: 'SIDEPIECE', venue: 'Radius', city: 'Chicago, IL', date: '2026-02-20', ageRestriction: '18+' },
    { artists: 'Audien', venue: 'TAO Chicago', city: 'Chicago, IL', date: '2026-02-20', ageRestriction: '21+' },
    { artists: 'CamelPhat', venue: 'The Salt Shed', city: 'Chicago, IL', date: '2026-04-17' },
    { artists: 'INZO, Truth, Late Night Radio, Blookah', venue: 'Radius', city: 'Chicago, IL', date: '2026-03-13', ageRestriction: '18+' },
    // === MIAMI ===
    { artists: 'We Belong Here: Lane 8, Chris Lake, Tiësto, Kaskade, Gorgon City', venue: 'Virginia Key Beach Park', city: 'Miami, FL', date: '2026-02-27', ageRestriction: '21+', type: 'FESTIVAL' },
    { artists: 'Deadbeats 10th Anniversary: Zeds Dead', venue: 'Mana Wynwood Convention Center', city: 'Miami, FL', date: '2026-03-26', type: 'FESTIVAL' },
    { artists: 'Brownies & Lemonade MMW', venue: 'Mana Wynwood Convention Center', city: 'Miami, FL', date: '2026-03-27', type: 'FESTIVAL' },
    { artists: 'Max Styler, Tiga, Azzecca, Bakke, Will Buck, Layla Benitez', venue: 'Club Space', city: 'Miami, FL', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'Sonny Fodera', venue: 'LIV Miami', city: 'Miami Beach, FL', date: '2026-02-07' },
    { artists: 'Rony Seikaly, Rafael, Yamagucci, Daizy, Siegel', venue: 'Club Space', city: 'Miami, FL', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'Boogie T, Austeria, Effin', venue: 'Kemistry', city: 'Fort Lauderdale, FL', date: '2026-02-07', ageRestriction: '18+' },
    { artists: 'Matroda, Joshwa, Thunderpony, Monoky, Basalyga', venue: 'Club Space', city: 'Miami, FL', date: '2026-02-13', ageRestriction: '21+' },
    { artists: 'Helena Hauff, Ladyboy, Souls Departed', venue: 'The Ground at Space', city: 'Miami, FL', date: '2026-02-13', ageRestriction: '18+' },
    { artists: 'Gryffin', venue: 'LIV Miami', city: 'Miami Beach, FL', date: '2026-02-14' },
    { artists: 'Ilan Bluestone', venue: 'Kemistry', city: 'Fort Lauderdale, FL', date: '2026-02-14', ageRestriction: '18+' },
    { artists: 'Victor Calderone, Themba, Danyelino, Alezsandro', venue: 'Club Space', city: 'Miami, FL', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'Markus Schulz, Emma Hewitt, Darude', venue: 'E11EVEN', city: 'Miami, FL', date: '2026-02-15' },
    { artists: 'Calvin Harris', venue: 'Palm Tree Club Miami', city: 'North Bay Village, FL', date: '2026-02-15', ageRestriction: '21+' },
    { artists: 'Marc Rebillet', venue: 'ZeyZey Miami', city: 'Miami, FL', date: '2026-02-18' },
    { artists: 'Jamie Jones, Ilario Alicante, Miguelle & Tons, Danyelino', venue: 'Club Space', city: 'Miami, FL', date: '2026-02-21', ageRestriction: '21+' },
    { artists: 'Jauz, 2AR', venue: 'Kemistry', city: 'Fort Lauderdale, FL', date: '2026-02-21', ageRestriction: '18+' },
    { artists: 'Paul van Dyk', venue: 'Kemistry', city: 'Fort Lauderdale, FL', date: '2026-02-27', ageRestriction: '18+' },
    { artists: 'WhoMadeWho, DJ Tennis, KinAhau', venue: 'Club Space', city: 'Miami, FL', date: '2026-02-28', ageRestriction: '21+' },
    // === DENVER ===
    { artists: 'Jan Blomqvist', venue: 'The Church Nightclub', city: 'Denver, CO', date: '2026-02-06', ageRestriction: '21+' },
    { artists: 'Adventure Club, AVELLO, SABAI', venue: 'Mission Ballroom', city: 'Denver, CO', date: '2026-02-06' },
    { artists: 'YDG, Costa, Bella Renee, KADE FINDLEY', venue: 'Summit Music Hall Denver', city: 'Denver, CO', date: '2026-02-07', ageRestriction: '18+' },
    { artists: 'Chris Lorenzo, San Pacho, Marco Strous', venue: 'Mission Ballroom', city: 'Denver, CO', date: '2026-02-07' },
    { artists: 'Caspa, The Widdler, Kursa, Dêtre, PAV4N', venue: 'ReelWorks Denver', city: 'Denver, CO', date: '2026-02-07', ageRestriction: '18+' },
    { artists: 'Mija, Only Fire', venue: 'The Church Nightclub', city: 'Denver, CO', date: '2026-02-07', ageRestriction: '21+' },
    { artists: 'Snow Strippers, EVILGIANE, EERA', venue: 'Fillmore Auditorium', city: 'Denver, CO', date: '2026-02-12' },
    { artists: 'Magic City Hippies, Supertaste', venue: 'Ogden Theatre', city: 'Denver, CO', date: '2026-02-13' },
    { artists: 'The Martinez Brothers, Wakyin', venue: 'Mission Ballroom', city: 'Denver, CO', date: '2026-02-13' },
    { artists: 'Space 92', venue: 'The Church Nightclub', city: 'Denver, CO', date: '2026-02-13', ageRestriction: '21+' },
    { artists: 'Wreckno, Super Future, ONHELL, Mindset', venue: 'Mission Ballroom', city: 'Denver, CO', date: '2026-02-14' },
    { artists: 'Catz \'n Dogz', venue: 'Club Vinyl', city: 'Denver, CO', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'Blanke (ÆON:MODE Set)', venue: 'The Church Nightclub', city: 'Denver, CO', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'ATB', venue: 'Temple Denver', city: 'Denver, CO', date: '2026-02-20', ageRestriction: '21+' },
    { artists: 'JOYRYDE', venue: 'The Church Nightclub', city: 'Denver, CO', date: '2026-02-20', ageRestriction: '21+' },
    { artists: 'SIDEPIECE, DANSYN, Dave Summer', venue: 'Mission Ballroom', city: 'Denver, CO', date: '2026-02-21' },
    { artists: 'Maddy O\'Neal, TOKiMONSTA, Mary Droppinz', venue: 'Mission Ballroom', city: 'Denver, CO', date: '2026-02-28' },
    { artists: 'Amtrac, Blank Sense, DRAMA', venue: 'Mission Ballroom', city: 'Denver, CO', date: '2026-02-27' },
    { artists: 'Monolink, Parallelle', venue: 'Summit Music Hall Denver', city: 'Denver, CO', date: '2026-02-24' },
    { artists: 'Disco Lines', venue: 'Farrand Field', city: 'Denver, CO', date: '2026-04-17' },
    { artists: 'Jeremy Olander', venue: 'Club Vinyl', city: 'Denver, CO', date: '2026-05-15', ageRestriction: '21+' },
    // === ATLANTA ===
    { artists: 'Excision: Nexus Tour', venue: 'Tabernacle Atlanta', city: 'Atlanta, GA', date: '2026-02-14', ageRestriction: '18+' },
    { artists: 'Subtronics, Boogie T, Level Up', venue: 'Tabernacle Atlanta', city: 'Atlanta, GA', date: '2026-02-21', ageRestriction: '18+' },
    { artists: 'John Summit', venue: 'District Atlanta', city: 'Atlanta, GA', date: '2026-02-20', ageRestriction: '21+' },
    { artists: 'REZZ, i_o', venue: 'Believe Music Hall', city: 'Atlanta, GA', date: '2026-02-13', ageRestriction: '18+' },
    { artists: 'Dom Dolla, Nora En Pure', venue: 'The Eastern', city: 'Atlanta, GA', date: '2026-02-27' },
    { artists: 'Vintage Culture, Solardo', venue: 'Ravine Atlanta', city: 'Atlanta, GA', date: '2026-02-28', ageRestriction: '21+' },
    { artists: 'Knock2, ISOxo, Hamdi', venue: 'Believe Music Hall', city: 'Atlanta, GA', date: '2026-03-06', ageRestriction: '18+' },
    { artists: 'Lane 8, Yotto, Ben Böhmer', venue: 'Terminal West', city: 'Atlanta, GA', date: '2026-03-07' },
    { artists: 'GRiZ', venue: 'Tabernacle Atlanta', city: 'Atlanta, GA', date: '2026-03-13', ageRestriction: '18+' },
    { artists: 'Clozee, CloZinger, Of The Trees', venue: 'Aisle 5', city: 'Atlanta, GA', date: '2026-03-14' },
    { artists: 'Charlotte de Witte, Amelie Lens', venue: 'District Atlanta', city: 'Atlanta, GA', date: '2026-03-20', ageRestriction: '21+' },
    { artists: 'Liquid Stranger, LSDREAM, Mersiv', venue: 'Believe Music Hall', city: 'Atlanta, GA', date: '2026-03-21', ageRestriction: '18+' },
    // === SAN FRANCISCO ===
    { artists: 'Fred again.., Skrillex', venue: 'Bill Graham Civic Auditorium', city: 'San Francisco, CA', date: '2026-02-28' },
    { artists: 'Four Tet, Floating Points', venue: 'The Midway', city: 'San Francisco, CA', date: '2026-02-14' },
    { artists: 'Bicep, Hammer', venue: 'Bill Graham Civic Auditorium', city: 'San Francisco, CA', date: '2026-02-21' },
    { artists: 'Mall Grab, DJ Seinfeld, Ross From Friends', venue: 'Public Works', city: 'San Francisco, CA', date: '2026-02-13', ageRestriction: '21+' },
    { artists: 'Wax Motif, AC Slater, Chris Lorenzo', venue: 'Audio SF', city: 'San Francisco, CA', date: '2026-02-20', ageRestriction: '21+' },
    { artists: 'Elderbrook', venue: 'The Regency Ballroom', city: 'San Francisco, CA', date: '2026-02-27' },
    { artists: 'Shiba San, Walker & Royce', venue: 'The Great Northern', city: 'San Francisco, CA', date: '2026-03-06', ageRestriction: '21+' },
    { artists: 'Disclosure', venue: 'Bill Graham Civic Auditorium', city: 'San Francisco, CA', date: '2026-03-07' },
    { artists: 'Boris Brejcha', venue: 'The Midway', city: 'San Francisco, CA', date: '2026-03-13' },
    { artists: 'Gesaffelstein', venue: 'Bill Graham Civic Auditorium', city: 'San Francisco, CA', date: '2026-03-20' },
    { artists: 'Dixon, Âme', venue: '1015 Folsom', city: 'San Francisco, CA', date: '2026-03-14', ageRestriction: '21+' },
    { artists: 'Peggy Gou', venue: 'The Midway', city: 'San Francisco, CA', date: '2026-03-21' },
    // === AUSTIN ===
    { artists: 'Fisher, Chris Lake', venue: 'Concourse Project', city: 'Austin, TX', date: '2026-02-14', ageRestriction: '18+' },
    { artists: 'ODESZA', venue: 'Stubb\'s BBQ Waller Creek Amphitheater', city: 'Austin, TX', date: '2026-03-13' },
    { artists: 'Green Velvet, Claude VonStroke', venue: 'Kingdom Austin', city: 'Austin, TX', date: '2026-02-20', ageRestriction: '21+' },
    { artists: 'Rufus Du Sol', venue: 'Concourse Project', city: 'Austin, TX', date: '2026-02-28', ageRestriction: '18+' },
    { artists: 'ZHU', venue: 'Concourse Project', city: 'Austin, TX', date: '2026-03-07', ageRestriction: '18+' },
    { artists: 'Diplo, DJ Snake', venue: 'Emo\'s Austin', city: 'Austin, TX', date: '2026-03-14' },
    { artists: 'Tchami, Malaa (No Redemption)', venue: 'Kingdom Austin', city: 'Austin, TX', date: '2026-03-20', ageRestriction: '21+' },
    { artists: 'Above & Beyond', venue: 'Concourse Project', city: 'Austin, TX', date: '2026-03-21', ageRestriction: '18+' },
    // === LAS VEGAS ===
    { artists: 'Tiësto', venue: 'Zouk Nightclub', city: 'Las Vegas, NV', date: '2026-02-14', ageRestriction: '21+' },
    { artists: 'Calvin Harris', venue: 'XS Nightclub', city: 'Las Vegas, NV', date: '2026-02-15', ageRestriction: '21+' },
    { artists: 'Steve Aoki', venue: 'Hakkasan', city: 'Las Vegas, NV', date: '2026-02-20', ageRestriction: '21+' },
    { artists: 'Zedd', venue: 'Omnia', city: 'Las Vegas, NV', date: '2026-02-21', ageRestriction: '21+' },
    { artists: 'Martin Garrix', venue: 'Omnia', city: 'Las Vegas, NV', date: '2026-02-28', ageRestriction: '21+' },
    { artists: 'Illenium', venue: 'Zouk Nightclub', city: 'Las Vegas, NV', date: '2026-03-06', ageRestriction: '21+' },
    { artists: 'Alesso', venue: 'XS Nightclub', city: 'Las Vegas, NV', date: '2026-03-07', ageRestriction: '21+' },
    { artists: 'David Guetta', venue: 'XS Nightclub', city: 'Las Vegas, NV', date: '2026-03-13', ageRestriction: '21+' },
    { artists: 'Marshmello', venue: 'Hakkasan', city: 'Las Vegas, NV', date: '2026-03-14', ageRestriction: '21+' },
    { artists: 'EDC Las Vegas 2026: Kaskade, Alison Wonderland, Seven Lions, Said The Sky', venue: 'EDC Las Vegas Motor Speedway', city: 'Las Vegas, NV', date: '2026-05-15', ageRestriction: '18+', type: 'FESTIVAL' },
    { artists: 'EDC Las Vegas 2026: Excision, NGHTMRE, Slander, Illenium, Zeds Dead', venue: 'EDC Las Vegas Motor Speedway', city: 'Las Vegas, NV', date: '2026-05-16', ageRestriction: '18+', type: 'FESTIVAL' },
    { artists: 'EDC Las Vegas 2026: Carl Cox, Eric Prydz, Adam Beyer, Amelie Lens', venue: 'EDC Las Vegas Motor Speedway', city: 'Las Vegas, NV', date: '2026-05-17', ageRestriction: '18+', type: 'FESTIVAL' },
    // === DETROIT ===
    { artists: 'Carl Craig, Moodymann, Stacey Pullen', venue: 'TV Lounge', city: 'Detroit, MI', date: '2026-02-13', ageRestriction: '21+' },
    { artists: 'Jeff Mills', venue: 'Spot Lite', city: 'Detroit, MI', date: '2026-02-14' },
    { artists: 'Claude VonStroke, Justin Martin', venue: 'Magic Stick', city: 'Detroit, MI', date: '2026-02-20', ageRestriction: '18+' },
    { artists: 'Nina Kraviz, Ben Klock', venue: 'Marble Bar', city: 'Detroit, MI', date: '2026-02-21', ageRestriction: '21+' },
    { artists: 'Derrick May, Kevin Saunderson, Juan Atkins', venue: 'The Masonic Temple', city: 'Detroit, MI', date: '2026-02-27' },
    { artists: 'Seth Troxler, The Black Madonna', venue: 'Leland City Club', city: 'Detroit, MI', date: '2026-02-28', ageRestriction: '21+' },
    { artists: 'Richie Hawtin, Dubfire', venue: 'TV Lounge', city: 'Detroit, MI', date: '2026-03-06', ageRestriction: '21+' },
    { artists: 'Movement Festival Preview: Dixon, Maceo Plex, Tale Of Us', venue: 'The Masonic Temple', city: 'Detroit, MI', date: '2026-03-13', type: 'FESTIVAL' },
    // === SEATTLE ===
    { artists: 'RÜFÜS DU SOL', venue: 'Showbox SoDo', city: 'Seattle, WA', date: '2026-02-14' },
    { artists: 'Tokimonsta, Nosaj Thing', venue: 'Neumos', city: 'Seattle, WA', date: '2026-02-20' },
    { artists: 'Bonobo, Totally Enormous Extinct Dinosaurs', venue: 'The Showbox', city: 'Seattle, WA', date: '2026-02-21' },
    { artists: 'SG Lewis', venue: 'Neptune Theatre', city: 'Seattle, WA', date: '2026-02-27' },
    { artists: 'Flume, Toro Y Moi', venue: 'Showbox SoDo', city: 'Seattle, WA', date: '2026-02-28' },
    { artists: 'Moderat', venue: 'The Showbox', city: 'Seattle, WA', date: '2026-03-06' },
    { artists: 'Yung Bae, Flamingosis', venue: 'Neumos', city: 'Seattle, WA', date: '2026-03-07' },
    { artists: 'Deadmau5, Testpilot', venue: 'Showbox SoDo', city: 'Seattle, WA', date: '2026-03-13' },
    // === WASHINGTON DC ===
    { artists: 'Excision: Nexus Tour', venue: 'Echostage', city: 'Washington, DC', date: '2026-02-13', ageRestriction: '18+' },
    { artists: 'Subtronics, G Jones', venue: 'Echostage', city: 'Washington, DC', date: '2026-02-20', ageRestriction: '18+' },
    { artists: 'FISHER', venue: 'Echostage', city: 'Washington, DC', date: '2026-02-21', ageRestriction: '18+' },
    { artists: 'Kaskade, Deadmau5 (Kx5)', venue: 'The Anthem', city: 'Washington, DC', date: '2026-02-27' },
    { artists: 'Jamie xx', venue: '9:30 Club', city: 'Washington, DC', date: '2026-02-28' },
    { artists: 'Adriatique, Fideles', venue: 'Flash DC', city: 'Washington, DC', date: '2026-03-06', ageRestriction: '21+' },
    { artists: 'Gorgon City', venue: 'Echostage', city: 'Washington, DC', date: '2026-03-07', ageRestriction: '18+' },
    { artists: 'Dimension, Culture Shock, Kanine', venue: 'Soundcheck', city: 'Washington, DC', date: '2026-03-13', ageRestriction: '18+' },
    { artists: 'Eric Prydz (HOLO)', venue: 'Echostage', city: 'Washington, DC', date: '2026-03-14', ageRestriction: '18+' },
    // === PHILADELPHIA ===
    { artists: 'Seven Lions, Jason Ross, Trivecta', venue: 'The Fillmore Philadelphia', city: 'Philadelphia, PA', date: '2026-02-14' },
    { artists: 'SLANDER, Said The Sky', venue: 'Franklin Music Hall', city: 'Philadelphia, PA', date: '2026-02-20' },
    { artists: 'Alison Wonderland', venue: 'Franklin Music Hall', city: 'Philadelphia, PA', date: '2026-02-21' },
    { artists: 'Chris Lake', venue: 'NOTO', city: 'Philadelphia, PA', date: '2026-02-27', ageRestriction: '21+' },
    { artists: 'Odesza', venue: 'The Fillmore Philadelphia', city: 'Philadelphia, PA', date: '2026-02-28' },
    { artists: 'Ganja White Night, Liquid Stranger', venue: 'Franklin Music Hall', city: 'Philadelphia, PA', date: '2026-03-06' },
    { artists: 'Armin van Buuren', venue: 'The Fillmore Philadelphia', city: 'Philadelphia, PA', date: '2026-03-07' },
    { artists: 'Louis The Child, Jai Wolf', venue: 'The Brooklyn Bowl Philadelphia', city: 'Philadelphia, PA', date: '2026-03-13' },
    // === FESTIVALS (Multi-day) ===
    { artists: 'Ultra Music Festival 2026: Martin Garrix, Armin van Buuren, Hardwell, Carl Cox', venue: 'Virginia Key Beach Park', city: 'Miami, FL', date: '2026-03-27', ageRestriction: '18+', type: 'FESTIVAL' },
    { artists: 'Ultra Music Festival 2026: Tiësto, David Guetta, Afrojack, Nicky Romero', venue: 'Virginia Key Beach Park', city: 'Miami, FL', date: '2026-03-28', ageRestriction: '18+', type: 'FESTIVAL' },
    { artists: 'Ultra Music Festival 2026: Skrillex, Deadmau5, Eric Prydz, Charlotte de Witte', venue: 'Virginia Key Beach Park', city: 'Miami, FL', date: '2026-03-29', ageRestriction: '18+', type: 'FESTIVAL' },
    { artists: 'Coachella 2026 Weekend 1: ODESZA, Disclosure, Bonobo, Moderat', venue: 'LA State Historic Park', city: 'Los Angeles, CA', date: '2026-04-10', type: 'FESTIVAL' },
    { artists: 'Electric Forest 2026: GRiZ, Pretty Lights, Bassnectar, STS9', venue: 'The Masonic Temple', city: 'Detroit, MI', date: '2026-06-25', type: 'FESTIVAL' },
    { artists: 'Lollapalooza 2026: Skrillex, Fred again.., Peggy Gou, John Summit', venue: 'The Salt Shed', city: 'Chicago, IL', date: '2026-07-30', type: 'FESTIVAL' },
  ];

  return events;
}

function getVenueInfo(venueName: string, cityFallback: string) {
  const coords = VENUE_COORDS[venueName];
  if (coords) return coords;

  // Approximate coords by city
  const cityCoords: Record<string, { lat: number; lng: number }> = {
    'New York, NY': { lat: 40.7128, lng: -74.0060 },
    'Brooklyn, NY': { lat: 40.6782, lng: -73.9442 },
    'Queens, NY': { lat: 40.7282, lng: -73.7949 },
    'Los Angeles, CA': { lat: 34.0522, lng: -118.2437 },
    'Santa Ana, CA': { lat: 33.7455, lng: -117.8677 },
    'West Hollywood, CA': { lat: 34.0900, lng: -118.3617 },
    'Costa Mesa, CA': { lat: 33.6412, lng: -117.9187 },
    'Inglewood, CA': { lat: 33.9617, lng: -118.3531 },
    'Chicago, IL': { lat: 41.8781, lng: -87.6298 },
    'Bridgeview, IL': { lat: 41.7501, lng: -87.8042 },
    'Miami, FL': { lat: 25.7617, lng: -80.1918 },
    'Miami Beach, FL': { lat: 25.7907, lng: -80.1300 },
    'Fort Lauderdale, FL': { lat: 26.1224, lng: -80.1373 },
    'North Bay Village, FL': { lat: 25.8461, lng: -80.1545 },
    'Davie, FL': { lat: 26.0629, lng: -80.2331 },
    'Denver, CO': { lat: 39.7392, lng: -104.9903 },
    'Boulder, CO': { lat: 40.0150, lng: -105.2705 },
    'Atlanta, GA': { lat: 33.7490, lng: -84.3880 },
    'San Francisco, CA': { lat: 37.7749, lng: -122.4194 },
    'Austin, TX': { lat: 30.2672, lng: -97.7431 },
    'Las Vegas, NV': { lat: 36.1699, lng: -115.1398 },
    'Detroit, MI': { lat: 42.3314, lng: -83.0458 },
    'Seattle, WA': { lat: 47.6062, lng: -122.3321 },
    'Washington, DC': { lat: 38.9072, lng: -77.0369 },
    'Philadelphia, PA': { lat: 39.9526, lng: -75.1652 },
  };

  const fallback = cityCoords[cityFallback] || { lat: 40.7128, lng: -74.0060 };
  return { ...fallback, city: cityFallback };
}

function extractPrimaryArtist(artistsStr: string): string {
  // Remove tour name prefixes
  const cleaned = artistsStr
    .replace(/^[^:]+:\s*/, '')
    .replace(/\s*b2b\s*.*/i, '')
    .split(',')[0]
    .trim();
  return cleaned || artistsStr.split(',')[0].trim();
}

async function main() {
  console.log('Starting EDM Train seed...');

  const rawEvents = parseEvents();
  console.log(`Parsed ${rawEvents.length} events from EDM Train data`);

  // Create artist accounts for unique primary artists
  const artistMap = new Map<string, { userId: string; artistId: string }>();
  const passwordHash_ = await hash('MiraCulture2026!', 10);

  for (const evt of rawEvents) {
    const primaryArtist = extractPrimaryArtist(evt.artists);
    if (artistMap.has(primaryArtist)) continue;

    const userId = randomUUID();
    const artistId = randomUUID();
    const email = primaryArtist
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 30) + '@miraculturee.demo';

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Find their artist record
      const existingArtist = await prisma.artist.findUnique({ where: { userId: existing.id } });
      if (existingArtist) {
        artistMap.set(primaryArtist, { userId: existing.id, artistId: existingArtist.id });
      }
      continue;
    }

    await prisma.user.create({
      data: {
        id: userId,
        email,
        passwordHash: passwordHash_,
        name: primaryArtist,
        role: 'ARTIST',
      },
    });

    await prisma.artist.create({
      data: {
        id: artistId,
        userId,
        stageName: primaryArtist,
        genre: 'Electronic',
        bio: `${primaryArtist} - performing live. Tickets available through MiraCulture.`,
      },
    });

    artistMap.set(primaryArtist, { userId, artistId });
  }

  console.log(`Created ${artistMap.size} artist accounts`);

  // Create events
  let createdCount = 0;
  for (const evt of rawEvents) {
    const primaryArtist = extractPrimaryArtist(evt.artists);
    const artist = artistMap.get(primaryArtist);
    if (!artist) continue;

    const venueInfo = getVenueInfo(evt.venue, evt.city);
    const eventDate = new Date(evt.date + 'T20:00:00Z');

    // Ticket price varies by event type: festivals $75-$350, shows $25-$150
    const isFestival = (evt.type ?? 'SHOW') === 'FESTIVAL';
    const ticketPriceCents = isFestival
      ? (Math.floor(Math.random() * 56) + 15) * 500  // $75-$350 in $5 increments
      : (Math.floor(Math.random() * 26) + 5) * 500;  // $25-$150 in $5 increments
    const totalTickets = isFestival
      ? Math.floor(Math.random() * 4000) + 1000  // 1000-5000 for festivals
      : Math.floor(Math.random() * 400) + 100;   // 100-500 for shows

    const eventId = randomUUID();

    try {
      await prisma.event.create({
        data: {
          id: eventId,
          artistId: artist.artistId,
          title: evt.artists.length > 100 ? evt.artists.substring(0, 100) : evt.artists,
          description: `Live performance at ${evt.venue}. ${evt.ageRestriction ? `Ages: ${evt.ageRestriction}.` : ''} Fan-powered tickets available through MiraCulture.`,
          venueName: evt.venue,
          venueAddress: `${evt.venue}, ${evt.city}`,
          venueLat: venueInfo.lat,
          venueLng: venueInfo.lng,
          venueCity: venueInfo.city || evt.city,
          date: eventDate,
          ticketPriceCents,
          totalTickets,
          localRadiusKm: 50,
          type: evt.type ?? 'SHOW',
          status: 'PUBLISHED',
        },
      });

      // Create a $5 raffle pool for each event
      await prisma.rafflePool.create({
        data: {
          eventId,
          tierCents: 500,
          status: 'OPEN',
          scheduledDrawTime: new Date(eventDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        },
      });

      createdCount++;
    } catch (err: any) {
      console.warn(`Skipped event "${evt.artists.substring(0, 40)}...": ${err.message}`);
    }
  }

  console.log(`Created ${createdCount} events with raffle pools`);

  // Create some demo fan accounts
  const fans = [
    { name: 'Alex Rivera', email: 'alex@miraculturee.demo', city: 'New York, NY', lat: 40.7128, lng: -74.0060, role: 'FAN' as const },
    { name: 'Jordan Wu', email: 'jordan@miraculturee.demo', city: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, role: 'LOCAL_FAN' as const },
    { name: 'Sam Nguyen', email: 'sam@miraculturee.demo', city: 'Chicago, IL', lat: 41.8781, lng: -87.6298, role: 'LOCAL_FAN' as const },
    { name: 'Maya Patel', email: 'maya@miraculturee.demo', city: 'Miami, FL', lat: 25.7617, lng: -80.1918, role: 'FAN' as const },
    { name: 'Chris Okafor', email: 'chris@miraculturee.demo', city: 'Denver, CO', lat: 39.7392, lng: -104.9903, role: 'LOCAL_FAN' as const },
  ];

  for (const fan of fans) {
    const existing = await prisma.user.findUnique({ where: { email: fan.email } });
    if (existing) continue;

    await prisma.user.create({
      data: {
        email: fan.email,
        passwordHash: passwordHash_,
        name: fan.name,
        role: fan.role,
        city: fan.city,
        lat: fan.lat,
        lng: fan.lng,
      },
    });
  }

  console.log('Created demo fan accounts');
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
