import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Stress Test tailored for Raspberry Pi 5 (16GB RAM, ARM64 Cortex-A76)
// Simulates concurrent retail operations across stores and online sellers.
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Warm-up ramp
    { duration: '1m',  target: 150 },  // Sustained store peak load
    { duration: '30s', target: 300 },  // Burst stress test
    { duration: '30s', target: 0 },    // Cool down
  ],
  thresholds: {
    // 95% of read requests must complete under 350ms (RPi 5 ARM64 target)
    'http_req_duration{type:read}': ['p(95)<350'],
    // 95% of mutation requests must complete under 800ms
    'http_req_duration{type:write}': ['p(95)<800'],
    // Error rate must stay strictly under 1%
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

function getHeaders(customHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...customHeaders,
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

export default function () {
  // 1. Health Probe
  const healthRes = http.get(`${BASE_URL}/health`, {
    tags: { type: 'read' },
  });
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Paginated Products Search (read stress)
  const productsRes = http.get(`${BASE_URL}/api/products?page=1&pageSize=20`, {
    headers: getHeaders(),
    tags: { type: 'read' },
  });
  check(productsRes, {
    'products status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // 3. Orders List (read stress)
  const ordersRes = http.get(`${BASE_URL}/api/orders?page=1&pageSize=20`, {
    headers: getHeaders(),
    tags: { type: 'read' },
  });
  check(ordersRes, {
    'orders status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // 4. Idempotent Mutation Simulation with X-Mutation-Id
  const mutationUuid = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const mutationPayload = JSON.stringify({
    notes: 'K6 Stress Test Mutation',
  });

  const mutationRes = http.post(`${BASE_URL}/api/orders`, mutationPayload, {
    headers: getHeaders({
      'X-Mutation-Id': mutationUuid,
    }),
    tags: { type: 'write' },
  });

  check(mutationRes, {
    'mutation responds with expected status (201, 400, or 401)': (r) =>
      [200, 201, 400, 401, 403].includes(r.status),
  });

  sleep(0.5);
}
