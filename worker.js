export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const params = url.searchParams;

    function generateToken(length = 10) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < length; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
      }
      return token;
    }

    function generateFinalID() {
      return Math.floor(1000 + Math.random() * 9000);
    }

    if (pathname === '/') {
      const token = generateToken();
      await env.MAZE_TOKENS.put(token, '', { expirationTtl: 3600 });
      return Response.redirect(`/step/1?token=${token}`, 302);
    }

    if (pathname.startsWith('/step/')) {
      const stepNumber = parseInt(pathname.split('/')[2]);
      const token = params.get('token');

      if (!token) return Response.redirect('/', 302);

      const stored = await env.MAZE_TOKENS.get(token);
      if (stored === null) return Response.redirect('/', 302);

      const lastStep = 3;
      if (stepNumber < lastStep) {
        const nextStep = stepNumber + 1;
        return Response.redirect(`/step/${nextStep}?token=${token}&src=step${stepNumber}`, 302);
      } else {
        return new Response(`
          <html>
            <body style="font-family:sans-serif;text-align:center;margin-top:50px;">
              <h1>Final Step: Submit Form</h1>
              <form method="POST" action="/submit?token=${token}">
                <input name="name" placeholder="Enter your name" required />
                <button type="submit">Submit</button>
              </form>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }
    }

    if (pathname === '/submit' && request.method === 'POST') {
      const token = params.get('token');
      if (!token) return Response.redirect('/', 302);

      const stored = await env.MAZE_TOKENS.get(token);
      if (stored === null) return Response.redirect('/', 302);

      const formData = await request.formData();
      const name = formData.get('name') || 'Guest';
      const finalID = generateFinalID();

      await env.MAZE_TOKENS.put(token, finalID.toString(), { expirationTtl: 24 * 3600 });

      return Response.redirect(`/page/id/${finalID}?token=${token}`, 302);
    }

    if (pathname.startsWith('/page/id/')) {
      const id = pathname.split('/')[3];
      const token = params.get('token');

      if (!token) return Response.redirect('/', 302);

      const storedID = await env.MAZE_TOKENS.get(token);
      if (storedID === null || storedID !== id) return Response.redirect('/', 302);

      return new Response(`
        <html>
          <body style="font-family:sans-serif;text-align:center;margin-top:50px;">
            <h1>🎉 Your Permanent Page</h1>
            <p>Your unique code is: <strong>${id}</strong></p>
            <p>Bookmark this page or add it to your iOS home screen!</p>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    return Response.redirect('/', 302);
  }
};
