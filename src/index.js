import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { URL as NodeURL } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// Wisp Configuration: Refer to the documentation at https://www.npmjs.com/package/@mercuryworkshop/wisp-js

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  hostname_blacklist: [/example\.com/],
  // Use non-filtering DNS resolvers to avoid blocked destinations
  dns_servers: ["1.1.1.1", "1.0.0.1"]
});

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				// Skip COOP/COEP on ad iframe routes to allow third-party content
				if (!req.url.startsWith('/ads/')) {
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				}
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
				else socket.end();
			});
	},
});

fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

fastify.register(fastifyStatic, {
  root: scramjetPath,
  prefix: "/scram/",
  decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});

// Simple server-side proxy for ad/affiliate links
// NOTE: Minimal rewriting for HTML and CSS. Not a full browser.
fastify.get('/ads/proxy', async (req, reply) => {
  try {
    const u = req.query?.u;
    if (!u) return reply.code(400).send('Missing u');
    let target;
    try { target = new NodeURL(u); } catch { return reply.code(400).send('Invalid URL'); }

    // Allow only http(s)
    if (!/^https?:$/.test(target.protocol)) return reply.code(400).send('Unsupported protocol');

    // Basic SSRF guard: block localhost and private IP hostnames
    const hostl = target.hostname.toLowerCase();
    const isBlockedHost = (
      hostl === 'localhost' || hostl.endsWith('.localhost') ||
      hostl === '127.0.0.1' || hostl.startsWith('127.') ||
      hostl.startsWith('10.') || hostl.startsWith('192.168.') ||
      (/^172\.(1[6-9]|2\d|3[0-1])\./).test(hostl) ||
      hostl === '::1' || hostl.startsWith('fe80:') || hostl.startsWith('fc') || hostl.startsWith('fd')
    );
    if (isBlockedHost) return reply.code(403).send('Forbidden host');

    const res = await fetch(target.toString(), {
      redirect: 'follow',
      headers: {
        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'accept': req.headers['accept'] || '*/*',
        'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      },
    });

    // Copy status
    reply.status(res.status);

    // Copy headers with filtering
    const contentType = res.headers.get('content-type') || '';
    // Remove headers that block embedding or cause issues
    const skipHeaders = new Set(['content-security-policy', 'x-frame-options', 'content-length']);
    res.headers.forEach((v, k) => {
      if (!skipHeaders.has(k.toLowerCase())) reply.header(k, v);
    });

    // Rewrite HTML and CSS to route subresources through this proxy
    if (contentType.includes('text/html')) {
      const text = await res.text();
      const base = target;
      const prox = (urlStr) => {
        try {
          const abs = new NodeURL(urlStr, base);
          return `/ads/proxy?u=${encodeURIComponent(abs.toString())}`;
        } catch { return urlStr; }
      };
      let out = text;
      // Rewrite common attributes: href, src, action, poster
      out = out.replace(/\b(href|src|action|poster)=("|')([^"']+)(\2)/gi, (m, attr, q, val) => {
        if (val.startsWith('data:') || val.startsWith('blob:') || val.startsWith('mailto:') || val.startsWith('javascript:')) return m;
        return `${attr}=${q}${prox(val)}${q}`;
      });
      // Basic CSS url() rewriting inside <style> blocks
      out = out.replace(/url\(([^)]+)\)/gi, (m, inner) => {
        const s = inner.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (s.startsWith('data:') || s.startsWith('blob:')) return m;
        return `url(${prox(s)})`;
      });
      // Remove CSP meta tags
      out = out.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
      reply.header('content-type', 'text/html; charset=utf-8');
      return reply.send(out);
    }

    if (contentType.includes('text/css')) {
      let css = await res.text();
      const base = target;
      const prox = (urlStr) => {
        try { const abs = new NodeURL(urlStr, base); return `/ads/proxy?u=${encodeURIComponent(abs.toString())}`; } catch { return urlStr; }
      };
      css = css.replace(/url\(([^)]+)\)/gi, (m, inner) => {
        const s = inner.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (s.startsWith('data:') || s.startsWith('blob:')) return m;
        return `url(${prox(s)})`;
      });
      reply.header('content-type', 'text/css; charset=utf-8');
      return reply.send(css);
    }

    // Stream other content types
    reply.header('cache-control', 'no-store');
    return reply.send(res.body);
  } catch (err) {
    return reply.code(502).type('text/plain').send('Proxy error');
  }
});

fastify.setNotFoundHandler((res, reply) => {
	return reply.code(404).type('text/html').sendFile('404.html');
})

fastify.server.on("listening", () => {
	const address = fastify.server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("NovaNet Proxy Server Started!");
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
	console.log("\nFeatures:");
	console.log("   • Modern browser-like interface");
	console.log("   • Multi-tab support");
	console.log("   • Secure web proxy");
	console.log("   • Bypass internet censorship");
	console.log("   • Privacy-focused browsing");
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	fastify.close();
	process.exit(0);
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

fastify.listen({
	port: port,
	host: "0.0.0.0",
});
