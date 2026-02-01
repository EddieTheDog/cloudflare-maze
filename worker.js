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

    // START: user clicks Start → create token → redirect to first step
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
      if (stored === null) return Response.redirect('/', 302);

      const lastStep = 3; // change this to 5-10 for more redirects
      if (stepNumber < lastStep) {
        const nextStep = stepNumber + 1;
        return Response.redirect(`/step/${nextStep}?token=${token}&src=step${stepNumber}`, 302);
      } else {
        // Last step: show form HTML directly
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Final Step - Form</title>
            <style>
              body { font-family: sans-serif; text-align:center; margin-top:50px; }
              input { padding:10px; margin:5px; }
              button { padding:10px; }
            </style>
            <script src="/maze.js"></script>
          </head>
          <body>
            <h1>Final Step: Submit Form</h1>
            <form method="POST" action="/submit?token=${token}">
              <input name="name" placeholder="Enter your name" required>
              <button type="submit">Submit</button>
            </form>
          </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }
    }

    // FORM SUBMISSION
    if (pathname === '/submit' && request.method === 'POST') {
      const token = params.get('token');
      if (!token) return Response.redirect('/', 302);

      const stored = await env.MAZE_TOKENS.get(token);
      if (stored === null) return Response.redirect('/', 302);

      const formData = await request.formData();
      const name = formData.get('name') || 'Guest';
      const finalID = generateFinalID();

      await env.MAZE_TOKENS.put(token, finalID.toString(), { expirationTtl: 24*3600 });

      return Response.redirect(`/final?id=${finalID}&token=${token}`, 302);
    }

    // FINAL PAGE
    if (pathname === '/final') {
      const token = params.get('token');
      const id = params.get('id');
      if (!token || !id) return Response.redirect('/', 302);

      const storedID = await env.MAZE_TOKENS.get(token);
      if (storedID === null || storedID !== id) return Response.redirect('/', 302);

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>🎉 Your Permanent Page</title>
          <style>
            body{font-family:sans-serif;text-align:center;margin-top:50px;}
          </style>
          <script src="/maze.js"></script>
        </head>
        <body>
          <h1>🎉 Your Permanent Page</h1>
          <p>Your unique code is: <strong>${id}</strong></p>
          <p>Bookmark this page or add it to your iOS home screen!</p>
        </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // SCRIPT: serve maze.js
    if (pathname === '/maze.js') {
      return new Response(`
        document.addEventListener('DOMContentLoaded', () => {
          console.log('🌀 Maze script active! Secret redirect maze!');
        });
      `, { headers: { 'Content-Type': 'application/javascript' } });
    }

    // DEFAULT: serve index.html
    if (pathname === '/' || pathname === '/index.html') {
      return fetch(new Request(`${url.origin}/index.html`));
    }

    // Anything else → redirect to /
    return Response.redirect('/', 302);
  }
};
