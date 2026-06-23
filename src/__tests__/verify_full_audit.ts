/**
 * Full Auth & User Isolation Verification — using axios with cookie jar
 */
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const BASE_URL = 'http://localhost:5000/api';

const results: any[] = [];
let userAToken = '';
let userBToken = '';
let userATripId = '';

// Create two separate axios clients with their own cookie jars
// (simulates two separate browsers/users)
function makeClient() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({
    baseURL: BASE_URL,
    jar,
    withCredentials: true,
    validateStatus: () => true, // Never throw on HTTP errors
    timeout: 10000,
  }));
  return client;
}

const clientA = makeClient(); // User A's "browser"
const clientB = makeClient(); // User B's "browser"

function pass(test: string, detail: string) {
  results.push({ test, status: '✅ PASS', detail });
  console.log(`✅ PASS | ${test}`);
  console.log(`        ${detail}\n`);
}
function fail(test: string, detail: string) {
  results.push({ test, status: '❌ FAIL', detail });
  console.error(`❌ FAIL | ${test}`);
  console.error(`        ${detail}\n`);
}
function warn(test: string, detail: string) {
  results.push({ test, status: '⚠️ WARN', detail });
  console.warn(`⚠️ WARN | ${test}`);
  console.warn(`        ${detail}\n`);
}

// Get CSRF token for a client — calling GET /csrf-token sets the cookie
async function getCsrfToken(client: any) {
  const res = await client.get('/auth/csrf-token');
  return res.data.csrfToken || '';
}

async function run() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TRAO AI — FULL AUTH & USER ISOLATION VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─── 1. CSRF works ───────────────────────────────────────────────────────
  const csrfA = await getCsrfToken(clientA);
  const csrfB = await getCsrfToken(clientB);
  if (csrfA && csrfB) {
    pass('CSRF Token', `Client A token: ${csrfA.substring(0,12)}... | Client B: ${csrfB.substring(0,12)}...`);
  } else {
    fail('CSRF Token', 'Could not get CSRF tokens');
    return;
  }

  const emailA = `alpha-${Date.now()}@test.trao.dev`;
  const emailB = `beta-${Date.now()}@test.trao.dev`;

  // ─── 2. Register User A ──────────────────────────────────────────────────
  const regA = await clientA.post('/auth/register', {
    name: 'User Alpha',
    email: emailA,
    password: 'TestPass123!',
  }, { headers: { 'x-xsrf-token': csrfA } });

  if (regA.status === 201 && regA.data.token) {
    userAToken = regA.data.token;
    pass('Register User A', `Created. ID: ${regA.data.data?.user?._id}`);
  } else {
    fail('Register User A', `Status: ${regA.status}, msg: ${regA.data.message}`);
    return;
  }

  // ─── 3. Duplicate Email Prevention ───────────────────────────────────────
  const dupA = await clientA.post('/auth/register', {
    name: 'Duplicate Alpha',
    email: emailA, // same email!
    password: 'AnotherPass789!',
  }, { headers: { 'x-xsrf-token': csrfA } });

  if (dupA.status === 409) {
    pass('Duplicate Email Prevention', `Correctly rejected with 409. Msg: "${dupA.data.message}"`);
  } else {
    fail('Duplicate Email Prevention', `Expected 409, got ${dupA.status}. Body: ${JSON.stringify(dupA.data)}`);
  }

  // ─── 4. Wrong Password Rejected ──────────────────────────────────────────
  const wrongPw = await clientA.post('/auth/login', {
    email: emailA,
    password: 'WRONG_PASSWORD_!',
  }, { headers: { 'x-xsrf-token': csrfA } });

  if (wrongPw.status === 401) {
    pass('Wrong Password Rejected', `Status 401. Msg: "${wrongPw.data.message}"`);
  } else {
    fail('Wrong Password Rejected', `Expected 401, got ${wrongPw.status}`);
  }

  // ─── 5. Login User A ─────────────────────────────────────────────────────
  const loginA = await clientA.post('/auth/login', {
    email: emailA,
    password: 'TestPass123!',
  }, { headers: { 'x-xsrf-token': csrfA } });

  if (loginA.status === 200 && loginA.data.token) {
    userAToken = loginA.data.token;
    pass('Login User A', `Logged in. Token: ${userAToken.substring(0,20)}...`);
  } else {
    fail('Login User A', `Status: ${loginA.status}, msg: ${loginA.data.message}`);
    return;
  }

  // ─── 6. Session Persistence (GET /me) ────────────────────────────────────
  const meA = await clientA.get('/auth/me', {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  if (meA.status === 200 && meA.data.data?.user?.email === emailA) {
    pass('Session Persistence (GET /me)', `User returned: ${meA.data.data.user.email}`);
  } else {
    fail('Session Persistence (GET /me)', `Status: ${meA.status}`);
  }

  // ─── 7. Password Not in Response ─────────────────────────────────────────
  const userInMe = meA.data.data?.user;
  if (userInMe && userInMe.password === undefined) {
    pass('Password Not Exposed', `Password field absent from API response ✅`);
  } else {
    fail('Password Not Exposed', `Password exposed! value: ${userInMe?.password}`);
  }

  // ─── 8. Register User B ──────────────────────────────────────────────────
  const regB = await clientB.post('/auth/register', {
    name: 'User Beta',
    email: emailB,
    password: 'TestPassB456!',
  }, { headers: { 'x-xsrf-token': csrfB } });

  if (regB.status === 201 && regB.data.token) {
    userBToken = regB.data.token;
    pass('Register User B', `Created. ID: ${regB.data.data?.user?._id}`);
  } else {
    fail('Register User B', `Status: ${regB.status}, msg: ${regB.data.message}`);
    return;
  }

  // ─── 9. User A Creates 5 Trips ───────────────────────────────────────────
  const tripsA = ['Paris', 'Tokyo', 'Rome', 'New York', 'Bali'];
  let createdA = 0;
  const tripPayload = (dest: string) => ({
    destination: dest,
    country: 'Various',
    durationDays: 5,
    budgetTier: 'medium',
    travelStyle: 'solo',
    interests: ['culture'],
    itinerary: [],
    hotels: [],
    estimatedBudget: {},
    packingList: [],
    travelTips: [],
    foodsToTry: [],
    weatherSuggestions: [],
    safetyTips: [],
    localEtiquette: [],
    status: 'completed',
  });

  for (const dest of tripsA) {
    const r = await clientA.post('/trips', tripPayload(dest), {
      headers: { 'x-xsrf-token': csrfA, Authorization: `Bearer ${userAToken}` },
    });
    if (r.status === 201) {
      createdA++;
      if (dest === 'Paris') userATripId = r.data.data?.trip?._id;
    }
  }
  if (createdA === 5) {
    pass('User A Creates 5 Trips', `All 5 created. First ID: ${userATripId}`);
  } else {
    fail('User A Creates 5 Trips', `Only ${createdA}/5 trips created`);
  }

  // ─── 10. User B Creates 2 Trips ──────────────────────────────────────────
  const tripsB = ['Sydney', 'London'];
  let createdB = 0;
  for (const dest of tripsB) {
    const r = await clientB.post('/trips', tripPayload(dest), {
      headers: { 'x-xsrf-token': csrfB, Authorization: `Bearer ${userBToken}` },
    });
    if (r.status === 201) createdB++;
  }
  if (createdB === 2) {
    pass('User B Creates 2 Trips', `Both created ✅`);
  } else {
    fail('User B Creates 2 Trips', `Only ${createdB}/2 trips created`);
  }

  // ─── 11. User A Sees Only 5 Trips ────────────────────────────────────────
  const listA = await clientA.get('/trips', {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  const countA = listA.data.data?.trips?.length;
  if (listA.status === 200 && countA === 5) {
    pass('User A Sees Only 5 Trips', `Trip count: ${countA} — No leakage ✅`);
  } else {
    fail('User A Sees Only 5 Trips', `Got ${countA} trips, expected 5`);
  }

  // ─── 12. User B Sees Only 2 Trips ────────────────────────────────────────
  const listB = await clientB.get('/trips', {
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  const countB = listB.data.data?.trips?.length;
  if (listB.status === 200 && countB === 2) {
    pass('User B Sees Only 2 Trips', `Trip count: ${countB} — No leakage ✅`);
  } else {
    fail('User B Sees Only 2 Trips', `Got ${countB} trips, expected 2`);
  }

  // ─── 13. Cross-User Read Denied ──────────────────────────────────────────
  if (userATripId) {
    const crossRead = await clientB.get(`/trips/${userATripId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    if (crossRead.status === 404 || crossRead.status === 403) {
      pass('Cross-User Read Denied', `User B blocked from User A trip. Status: ${crossRead.status} ✅`);
    } else {
      fail('Cross-User Read Denied', `DATA LEAK! Got status ${crossRead.status}`);
    }
  } else {
    warn('Cross-User Read Denied', 'No trip ID available to test');
  }

  // ─── 14. Cross-User Delete Denied ────────────────────────────────────────
  if (userATripId) {
    const crossDel = await clientB.delete(`/trips/${userATripId}`, {
      headers: { 'x-xsrf-token': csrfB, Authorization: `Bearer ${userBToken}` },
    });
    if (crossDel.status === 404 || crossDel.status === 403) {
      pass('Cross-User Delete Denied', `User B cannot delete User A trip. Status: ${crossDel.status} ✅`);
    } else {
      fail('Cross-User Delete Denied', `SECURITY BREACH! Got status ${crossDel.status}`);
    }
  }

  // ─── 15. Unauthenticated Access Denied ───────────────────────────────────
  const clientAnon = makeClient(); // Fresh client with no cookies/tokens
  const noAuth = await clientAnon.get('/trips');
  if (noAuth.status === 401) {
    pass('Unauthenticated Access Denied', `GET /trips without token → 401 ✅`);
  } else {
    fail('Unauthenticated Access Denied', `Expected 401, got ${noAuth.status}`);
  }

  // ─── 16. Trip Stats User Isolation ───────────────────────────────────────
  const statsA = await clientA.get('/trips/stats', {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  if (statsA.status === 200 && statsA.data.data?.totalTrips === 5) {
    pass('Trip Stats User Isolation', `User A stats: ${statsA.data.data.totalTrips} trips (correct) ✅`);
  } else {
    fail('Trip Stats User Isolation', `Got totalTrips=${statsA.data.data?.totalTrips}, expected 5. Status: ${statsA.status}`);
  }

  // ─── 17. Logout ──────────────────────────────────────────────────────────
  const logoutA = await clientA.post('/auth/logout', {}, {
    headers: { 'x-xsrf-token': csrfA, Authorization: `Bearer ${userAToken}` },
  });
  if (logoutA.status === 200) {
    pass('Logout', `User A logged out successfully ✅`);
  } else {
    fail('Logout', `Status: ${logoutA.status}`);
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.status === '✅ PASS').length;
  const failed = results.filter(r => r.status === '❌ FAIL').length;
  const warned = results.filter(r => r.status === '⚠️ WARN').length;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FINAL AUDIT RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  results.forEach(r => console.log(`${r.status} | ${r.test}`));
  console.log(`\nTotal: ${passed} ✅ passed, ${failed} ❌ failed, ${warned} ⚠️ warnings`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
