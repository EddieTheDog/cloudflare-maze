export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const params = url.searchParams;

    // Helpers
    function generateToken(length = 10) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < length; i++) token += chars[Math.floor(Math.random() * chars.length)];
      return token;
    }
    function generateFinalID() {
      return Math.floor(1000 + Math.random() * 9000);
    }

    // SERVE index.html for landing page
    if (pathname === '/' || pathname === '/index.html') {
      return fetch(new Request(`${url.origin}/index.html`));
    }

    // START: generate token & redirect to first “step” (simulated maze)
    if (pathname === '/start') {
      const token = generateToken();
      await env.MAZE_TOKENS.put(token, '', { expirationTtl: 3600 });
      return Response.redirect(`/step/1?token=${token}`, 302);
    }

    // STACKED REDIRECTS
    if (pathname.startsWith('/step/')) {
      const stepNumber = parseInt(pathname.split('/')[2]);
      const token = params.get('token');
      if (!token) return Response.redirect('/', 302);

      const stored = await env.MAZE_TOKENS.get(token);
      if (!stored) return Response.redirect('/', 302);

      const lastStep = 3;
      if (stepNumber < lastStep) {
        const nextStep = stepNumber + 1;
        return Response.redirect(`/step/${nextStep}?token=${token}&src=step${stepNumber}`, 302);
      } else {
        // Last step: return index.html (form section active handled by JS)
        return fetch(new Request(`${url.origin}/index.html`));
      }
    }

    // HANDLE FORM SUBMISSION
    if (pathname === '/submit' && request.method === 'POST') {
      const formData = await request.formData();
      const name = formData.get('name') || 'Guest';
      const interests = formData.get('interests') || '';
      const content = formData.get('content') || '';

      // Generate token & final ID
      const token = generateToken();
      const finalID = generateFinalID();
      await env.MAZE_TOKENS.put(token, finalID.toString(), { expirationTtl: 24*3600 });

      // Redirect back to index.html with final ID & token
      return Response.redirect(`/index.html?id=${finalID}&token=${token}`, 302);
    }

    // SERVE maze.js
    if (pathname === '/maze.js') {
      return new Response(`
        document.addEventListener('DOMContentLoaded', () => {
          console.log('🌀 Maze script active! Secret redirect maze!');
        });
      `, { headers: { 'Content-Type': 'application/javascript' } });
    }

    // DEFAULT → redirect to index.html
    return Response.redirect('/', 302);
  }
};
