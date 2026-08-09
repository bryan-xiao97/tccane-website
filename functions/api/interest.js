import { handleInterestPost } from '../lib/handler.js';

export async function onRequest(context) {
  const { request, env } = context;
  return handleInterestPost(request, env, { fetchImpl: fetch });
}

export async function onRequestPost(context) {
  return onRequest(context);
}
