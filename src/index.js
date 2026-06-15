import {html} from './landing';
import {handleWebhook} from './handlers';

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'POST') {
            return await handleWebhook(request, env);
        } else {
            return new Response(html, {
                status: 200,
                headers: {'Content-Type': 'text/html'},
            });
        }
    },
};