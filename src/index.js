import {html} from './landing';
import {handleWebhook, handleFileProxy} from './handlers';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === 'POST') {
            return await handleWebhook(request, env);
        } else if (request.method === 'GET' && url.pathname.startsWith('/file/')) {
            return await handleFileProxy(request, env);
        } else {
            return new Response(html, {
                status: 200,
                headers: {'Content-Type': 'text/html'},
            });
        }
    },
};