/* What's new drafts (v52.89). When a feature worth announcing ships, Claude adds a suggested announcement here in the
   same change. Once that update is live, the server adds it to the admin dashboard's Announce page as a draft and raises
   a "Waiting on you" alert. Nothing reaches users until the admin sends it. Each key is used once: a draft that was sent
   or discarded never comes back, so old entries can stay in this list.
   { key: unique and never reused, title: up to 70 characters, body: up to 200, go: '' | add | board | stories | budget | premium | ask,
     aud: all | free | premium } */
export const DRAFTS = [
];
