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
};

// Parsed events from EDM Train scrape
interface RawEvent {
  artists: string;
  venue: string;
  city: string;
  date: string;
  ageRestriction?: string;
}

function parseEvents(): RawEvent[] {
  const events: RawEvent[] = [
    // === NEW YORK CITY ===
    { artists: 'Spring Festival - Lunar New Year: Porter Robinson, Wavedash, Hoodini, Jokah, Gianni Glo', venue: 'Brooklyn Hangar', city: 'Brooklyn, NY', date: '2026-02-14' },
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
    { artists: 'Spring Festival: Alan Walker, Mike Posner, KUPYD, Cyberpunk', venue: 'Brooklyn Hangar', city: 'Brooklyn, NY', date: '2026-02-15', ageRestriction: '21+' },
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
    { artists: 'North Coast Music Festival: GRiZ, Ganja White Night, Fisher, SLANDER', venue: 'SeatGeek Stadium', city: 'Bridgeview, IL', date: '2026-09-04' },
    { artists: 'Beyond Wonderland Chicago: Marshmello, James Hype, Alan Walker, Dombresky', venue: 'Huntington Bank Pavilion', city: 'Chicago, IL', date: '2026-06-06', ageRestriction: '18+' },
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
    { artists: 'We Belong Here: Lane 8, Chris Lake, Tiësto, Kaskade, Gorgon City', venue: 'Virginia Key Beach Park', city: 'Miami, FL', date: '2026-02-27', ageRestriction: '21+' },
    { artists: 'Deadbeats 10th Anniversary: Zeds Dead', venue: 'Mana Wynwood Convention Center', city: 'Miami, FL', date: '2026-03-26' },
    { artists: 'Brownies & Lemonade MMW', venue: 'Mana Wynwood Convention Center', city: 'Miami, FL', date: '2026-03-27' },
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

    // Random ticket price between $25-$150
    const ticketPriceCents = (Math.floor(Math.random() * 26) + 5) * 500; // $25-$150 in $5 increments
    const totalTickets = Math.floor(Math.random() * 400) + 100; // 100-500 tickets

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
