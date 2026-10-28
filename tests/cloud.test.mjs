import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudHandler} from '../server/cloud.mjs';
const base = 'https://modul.test';
const req = (path, method = 'GET', body, extra = {}) => new Request(base + path, {method, headers: {origin: base, 'content-type': 'application/json', ...extra}, body: body === undefined ? undefined : JSON.stringify(body)});
test('cloud: rejects cross-origin changes before contacting Auth', async () => {
  const handler = createCloudHandler(() => { throw Error('must not run'); });
  assert.equal((await handler(req('/api/auth/login','POST',{}, {origin:'https://evil.test'}))).status,403);
});
test('cloud: projects require a verified session; unknown routes are 404', async () => {
  const handler = createCloudHandler(() => ({}));
  assert.equal((await handler(req('/api/projects'))).status,401);
  assert.equal((await handler(req('/api/no-such-route'))).status,404);
  assert.equal((await handler(req('/api/health','POST',{}))).status,405);
});
test('cloud: confirmation does not claim to create a session', async () => {
  const handler = createCloudHandler(() => ({auth:{signUp:async()=>({data:{user:{id:'id'},session:null},error:null})}}));
  const response=await handler(req('/api/auth/register','POST',{email:'test@example.com',password:'test-password'}));
  assert.equal(response.status,202);
  assert.deepEqual(await response.json(),{user:null,confirmationRequired:true});
  assert.equal(response.headers.get('set-cookie'),null);
});
test('cloud: login uses private secure cookies without tokens in JSON', async () => {
  const handler=createCloudHandler(()=>({auth:{signInWithPassword:async()=>({data:{user:{id:'u',email:'test@example.com'},session:{access_token:'access',refresh_token:'refresh'}},error:null})}}));
  const response=await handler(req('/api/auth/login','POST',{email:'test@example.com',password:'test-password'}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{user:{id:'u',email:'test@example.com'}});
  assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  assert.match(response.headers.get('cache-control'),/no-store/);
});
test('cloud: invalid sessions cannot read projects', async () => {
  const handler=createCloudHandler(()=>({auth:{setSession:async()=>({data:{},error:{message:'invalid'}})}}));
  const response=await handler(req('/api/projects','GET',undefined,{cookie:'modul_access=invalid; modul_refresh=invalid'}));
  assert.equal(response.status,401);
  assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
});
test('cloud: malformed project is rejected before database write', async () => {
  const handler=createCloudHandler(()=>({auth:{setSession:async()=>({data:{user:{id:'u'},session:{access_token:'access',refresh_token:'refresh'}},error:null})},from:()=>{throw Error('must not write');}}));
  const response=await handler(req('/api/projects','POST',{data:{}},{cookie:'modul_access=access; modul_refresh=refresh'}));
  assert.equal(response.status,400);
});
