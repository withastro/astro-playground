import type { APIRoute } from 'astro'

export const post: APIRoute = async ({ request }) => {
    const json = JSON.parse(await request.text());
    console.log(json);
    return new Response('success!')
}
