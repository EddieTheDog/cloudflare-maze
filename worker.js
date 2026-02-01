import crypto from 'crypto';

// Use a secret key for encryption (32 bytes)
const SECRET_KEY = 'YOUR_SECRET_KEY_32CHARSLONG12345678';

function encrypt(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const alg = { name: "AES-GCM", iv: iv };
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET_KEY), 'AES-GCM', false, ['encrypt'])
    .then(key => crypto.subtle.encrypt(alg, key, enc.encode(text)))
    .then(buf => {
      const combined = new Uint8Array(iv.length + buf.byteLength);
      combined.set(iv,0);
      combined.set(new Uint8Array(buf), iv.length);
      return btoa(String.fromCharCode(...combined));
    });
}

function decrypt(data) {
  const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const iv = combined.slice(0,12);
  const encData = combined.slice(12);
  const alg = { name:"AES-GCM", iv:iv };
  return crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET_KEY), 'AES-GCM', false, ['decrypt'])
    .then(key => crypto.subtle.decrypt(alg, key, encData))
    .then(buf => new TextDecoder().decode(buf));
}

// Helpers
function generateToken(length=10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token='';
  for(let i=0;i<length;i++) token += chars[Math.floor(Math.random()*chars.length)];
  return token;
}

function generateFinalID() {
  return Math.floor(1000+Math.random()*9000);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Serve index.html
    if(pathname==='/'||pathname==='/index.html') return fetch(new Request(`${url.origin}/index.html`));

    // START maze
    if(pathname==='/start') {
      const token = generateToken();
      await env.MAZE_TOKENS.put(token,'',{expirationTtl:3600});
      return Response.redirect(`/step/1?token=${token}`,302);
    }

    // STACKED REDIRECTS
    if(pathname.startsWith('/step/')) {
      const stepNumber=parseInt(pathname.split('/')[2]);
      const token=url.searchParams.get('token');
      if(!token) return Response.redirect('/',302);
      const stored=await env.MAZE_TOKENS.get(token);
      if(!stored) return Response.redirect('/',302);
      const lastStep=3;
      if(stepNumber<lastStep) return Response.redirect(`/step/${stepNumber+1}?token=${token}`,302);
      return fetch(new Request(`${url.origin}/index.html`));
    }

    // FORM SUBMISSION
    if(pathname==='/submit' && request.method==='POST') {
      const formData = await request.formData();
      const dataObj = {
        name: formData.get('name') || 'Guest',
        interests: formData.get('interests') || '',
        content: formData.get('content') || ''
      };
      const token = generateToken();
      const finalID = generateFinalID();
      const encrypted = await encrypt(JSON.stringify(dataObj));
      await env.MAZE_TOKENS.put(token, encrypted,{expirationTtl:24*3600});
      return Response.redirect(`/index.html?id=${finalID}&token=${token}`,302);
    }

    // Serve maze.js
    if(pathname==='/maze.js') {
      return new Response(`
        document.addEventListener('DOMContentLoaded',()=>{console.log('🌀 Maze script active!')});
      `,{headers:{'Content-Type':'application/javascript'}});
    }

    // DEFAULT redirect
    return Response.redirect('/',302);
  }
};
