// Public content smoke test (suyai-back#97). Read-only: sends anonymous GraphQL queries and
// non-mutating REST probes, never writes.
//
//   node scripts/smoke-public-content.mjs                 # https://api.transfersuyai.cl
//   API_URL=http://localhost:1337 node scripts/smoke-public-content.mjs
//
// Exit code 1 when any type the frontend (villa-tour src/api/Queries.ts) reads is Forbidden
// or null, or when the Public role can write content.

const API = (process.env.API_URL ?? 'https://api.transfersuyai.cl').replace(/\/+$/, '');

// One check per type queried by villa-tour. `required: false` marks content that is
// allowed to be empty (the frontend hides the section), so it only warns.
const CHECKS = [
  { name: 'home', query: '{ home { documentId hero { title } } }', required: true },
  { name: 'transfer', query: '{ transfer { documentId hero { title } } }', required: true },
  { name: 'tour', query: '{ tour { documentId hero { title } cards { title } seo { metaTitle } } }', required: true },
  { name: 'global', query: '{ global { siteName siteDescription season } }', required: true },
  { name: 'navbar', query: '{ navbar { documentId links { url } } }', required: true },
  { name: 'footer', query: '{ footer { documentId copy officeLocation } }', required: true },
  { name: 'term', query: '{ term { documentId title } }', required: true },
  { name: 'privacy', query: '{ privacy { documentId title } }', required: true },
  { name: 'articles', query: '{ articles(pagination: { limit: 1 }) { documentId category { slug } } }', required: true },
  { name: 'categories', query: '{ categories(pagination: { limit: 1 }) { documentId } }', required: true },
  { name: 'destinations', query: '{ destinations(pagination: { limit: 1 }) { documentId tours { documentId } } }', required: true },
  { name: 'magicBanner', query: '{ magicBanner { documentId title } }', required: false },
  { name: 'testimonials', query: '{ testimonials(pagination: { limit: 1 }) { documentId } }', required: false },
  { name: 'tableInformations', query: '{ tableInformations(pagination: { limit: 1 }) { documentId } }', required: false },
];

// Anonymous writes must be rejected. An empty body is used on purpose: when the action is
// allowed Strapi answers 400 "Missing data payload" without writing; when it is denied, 403.
const WRITE_PROBES = [
  ['PUT', '/api/home'],
  ['PUT', '/api/tour'],
  ['PUT', '/api/transfer'],
  ['PUT', '/api/global'],
  ['PUT', '/api/navbar'],
  ['PUT', '/api/footer'],
  ['PUT', '/api/term'],
  ['PUT', '/api/privacy'],
  ['PUT', '/api/magic-banner'],
  ['POST', '/api/categories'],
  ['POST', '/api/destinations'],
  ['POST', '/api/testimonials'],
  ['POST', '/api/articles'],
  ['POST', '/api/table-informations'],
];

const isEmpty = (v) => v == null || (Array.isArray(v) && v.length === 0);

let failures = 0;
let warnings = 0;

for (const c of CHECKS) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: c.query }),
  });
  const json = await res.json().catch(() => ({}));
  const errors = json.errors?.map((e) => e.message).join('; ');
  const value = json.data?.[c.name];
  if (errors || !res.ok) {
    failures += 1;
    console.log(`FAIL  ${c.name}: ${errors ?? `HTTP ${res.status}`}`);
  } else if (isEmpty(value)) {
    if (c.required) failures += 1;
    else warnings += 1;
    console.log(`${c.required ? 'FAIL' : 'WARN'}  ${c.name}: empty (no published content)`);
  } else {
    console.log(`ok    ${c.name}`);
  }
}

for (const [method, path] of WRITE_PROBES) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (res.status === 403 || res.status === 404 || res.status === 405) {
    console.log(`ok    anonymous ${method} ${path} -> ${res.status}`);
  } else {
    failures += 1;
    console.log(`FAIL  anonymous ${method} ${path} -> ${res.status} (Public can write)`);
  }
}

console.log(`\n${failures} failure(s), ${warnings} warning(s) against ${API}`);
process.exit(failures ? 1 : 0);
