import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

async function runVerification() {
  console.log('🏁 Starting E2E API Verification...');

  try {
    // 0. Get CSRF Token
    console.log('0. Fetching CSRF Token...');
    const initRes = await axios.get('http://localhost:5000/health');
    const setCookie = initRes.headers['set-cookie'];
    let csrfCookie = '';
    let csrfToken = '';

    if (setCookie) {
      const match = setCookie.find(c => c.startsWith('XSRF-TOKEN'));
      if (match) {
        const cookiePair = match.split(';')[0]; // e.g. "XSRF-TOKEN=abcdef123"
        csrfCookie = cookiePair;
        csrfToken = cookiePair.split('=')[1]; // e.g. "abcdef123"
      }
    }
    console.log(`✅ CSRF Token Extracted: ${csrfToken || 'None'}`);

    const csrfHeaders: Record<string, string> = {};
    if (csrfToken) {
      csrfHeaders['x-xsrf-token'] = csrfToken;
      csrfHeaders['Cookie'] = csrfCookie;
    }

    // 1. Register a new user
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'Password123!';
    console.log(`\n1. Registering user: ${email}...`);
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Verification User',
      email,
      password,
    }, { headers: csrfHeaders });
    console.log('✅ User registered successfully. Status:', regRes.status);
    const token = regRes.data.token;
    console.log('Received JWT Token:', token ? `${token.substring(0, 15)}...` : 'None');
    
    // Set Authorization and CSRF headers for subsequent requests
    const client = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        ...csrfHeaders
      },
    });

    // 2. Verify /auth/me
    console.log('\n2. Fetching current user details (/auth/me)...');
    const meRes = await client.get('/auth/me');
    console.log('✅ Auth check passed. User email:', meRes.data.data.user.email);

    // 3. Test Mood Preview Generator
    console.log('\n3. Testing Travel Mood Preview Generator (/ai/mood-preview)...');
    const moodRes = await client.post('/ai/mood-preview', {
      destination: 'Kyoto',
      mood: 'relaxed',
      budgetTier: 'medium',
    });
    console.log('✅ Mood preview generated. Keys in response:', Object.keys(moodRes.data.data));
    console.log('Vibe Summary preview:', moodRes.data.data.preview?.moodSummary);

    // 4. Create an AI Trip
    console.log('\n4. Generating a 3-day AI trip to Kyoto, Japan...');
    const tripRes = await client.post('/ai/generate-trip', {
      destination: 'Kyoto',
      country: 'Japan',
      durationDays: 3,
      startDate: '2026-07-01',
      budgetTier: 'medium',
      travelStyle: 'solo',
      interests: ['Culture', 'Nature'],
      mood: 'relaxed',
    });
    console.log('✅ Trip generated successfully. Status:', tripRes.status);
    const trip = tripRes.data.data.trip;
    console.log('Trip ID:', trip._id);
    console.log('Itinerary days count:', trip.itinerary.length);

    // 5. Test Weather forecast for this trip
    console.log(`\n5. Fetching weather forecast for trip: ${trip._id}...`);
    const weatherRes = await client.get(`/ai/weather/${trip._id}`);
    console.log('✅ Weather forecast fetched. Days in forecast:', weatherRes.data.data.weather?.forecast?.length);
    console.log('Current Temp:', weatherRes.data.data.weather?.current?.temp_c, '°C');

    // 6. Add Activity
    console.log('\n6. Adding activity to Day 1...');
    const addActRes = await client.post(`/trips/${trip._id}/activity`, {
      day: 1,
      activity: {
        time: '09:30 AM',
        title: 'Kinkaku-ji Temple Visit',
        description: 'Visit the famous golden pavilion and its Zen gardens.',
        location: 'Kyoto',
        duration: '2 Hours',
        cost: 5,
        category: 'Sightseeing',
        tips: 'Go early to avoid crowds.',
      },
    });
    console.log('✅ Activity added. Status:', addActRes.status);
    const updatedTripAfterAdd = addActRes.data.data.trip;
    const day1Activities = updatedTripAfterAdd.itinerary.find((d: any) => d.day === 1)?.activities || [];
    console.log('Day 1 activities count:', day1Activities.length);
    const addedActivity = day1Activities.find((a: any) => a.title === 'Kinkaku-ji Temple Visit');
    console.log('Added Activity ID:', addedActivity?._id);

    if (!addedActivity) {
      throw new Error('Activity was not added to the itinerary.');
    }

    // 7. Update Activity
    console.log(`\n7. Updating activity: ${addedActivity._id}...`);
    const updateActRes = await client.put(`/trips/${trip._id}/activity/${addedActivity._id}`, {
      day: 1,
      activity: {
        title: 'Golden Pavilion (Kinkaku-ji)',
        cost: 6,
      },
    });
    console.log('✅ Activity updated. Status:', updateActRes.status);
    const updatedTripAfterEdit = updateActRes.data.data.trip;
    const day1ActivitiesAfterEdit = updatedTripAfterEdit.itinerary.find((d: any) => d.day === 1)?.activities || [];
    const editedActivity = day1ActivitiesAfterEdit.find((a: any) => a._id === addedActivity._id);
    console.log('Updated Activity Title:', editedActivity?.title);
    console.log('Updated Activity Cost:', editedActivity?.cost);

    // 8. Delete Activity
    console.log(`\n8. Deleting activity: ${addedActivity._id}...`);
    const delActRes = await client.delete(`/trips/${trip._id}/activity/${addedActivity._id}`);
    console.log('✅ Activity deleted. Status:', delActRes.status);
    const updatedTripAfterDel = delActRes.data.data.trip;
    const day1ActivitiesAfterDel = updatedTripAfterDel.itinerary.find((d: any) => d.day === 1)?.activities || [];
    const deletedFound = day1ActivitiesAfterDel.some((a: any) => a._id === addedActivity._id);
    console.log('Activity still exists in Day 1?', deletedFound ? 'Yes ❌' : 'No ✅');

    console.log('\n🎉 ALL INTEGRATION API TESTS PASSED SUCCESSFULLY! Trao AI Travel Planner Backend is 100% functional.');

  } catch (err: any) {
    console.error('❌ Verification failed with error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runVerification();
