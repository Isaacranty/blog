/* ═══════════════════════════════════════════════════════════════
   Kirenga Blog — db.js  (Database Layer)
   Uses Supabase PostgreSQL when credentials are provided.
   Falls back gracefully to localStorage if not configured.

   HOW TO ACTIVATE:
   1. Go to https://supabase.com → create a free account
   2. Create a new project (free tier, no credit card needed)
   3. Go to Project Settings → API
   4. Copy your "Project URL" and "anon public" key
   5. Paste them below replacing the placeholder values
   6. In Supabase → SQL Editor → paste schema.sql → Run
   7. Reload your site — the badge changes to 🟢 Supabase DB
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════════
   ▶ STEP 1: PASTE YOUR SUPABASE CREDENTIALS HERE
════════════════════════════════════════════════════════════ */
const SUPABASE_URL      = 'https://jcjrbjxxbvsbeblfnnzf.supabase.co';   // ← replace
const SUPABASE_ANON_KEY = 'sb_publishable__qrewhIcZ7siJunrafDYxQ_bmMKHHKO';              // ← replace

/* ════════════════════════════════════════════════════════════
   DB MODE DETECTION
════════════════════════════════════════════════════════════ */
const DB_READY = (
  SUPABASE_URL      !== 'https://jcjrbjxxbvsbeblfnnzf.supabase.co' &&
  SUPABASE_ANON_KEY !== 'sb_publishable__qrewhIcZ7siJunrafDYxQ_bmMKHHKO' &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.length > 20
);

/* Status badge shown at the bottom-left of the page */
function showDbStatus() {
  const existing = document.getElementById('db-status-badge');
  if (existing) existing.remove();
  const badge = document.createElement('div');
  badge.id = 'db-status-badge';
  badge.style.cssText = 'position:fixed;bottom:80px;left:16px;z-index:99998;padding:6px 12px;border-radius:50px;font-size:.72rem;font-weight:700;font-family:DM Sans,sans-serif;letter-spacing:.3px;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer;transition:opacity .3s ease;';
  badge.title = DB_READY ? 'Connected to Supabase cloud database' : 'Using localStorage. Add Supabase credentials to db.js to enable cloud sync.';
  if (DB_READY) { badge.style.background = '#34a853'; badge.style.color = 'white'; badge.innerHTML = '🟢 Supabase DB'; }
  else { badge.style.background = '#f9ab00'; badge.style.color = '#1c1c2e'; badge.innerHTML = '🟡 Local Storage'; }
  document.body.appendChild(badge);
  setTimeout(() => { badge.style.opacity = '0'; setTimeout(() => badge.remove(), 400); }, 7000);
  badge.addEventListener('click', () => badge.remove());
}

/* ════════════════════════════════════════════════════════════
   SUPABASE REST API WRAPPER
════════════════════════════════════════════════════════════ */
const SB = {
  headers: {
    'Content-Type':  'application/json',
    'apikey':         SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer':         'return=representation',
  },

  async get(table, params = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: { ...SB.headers, 'Prefer': 'return=representation' }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST', headers: SB.headers, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async patch(table, match, body) {
    const query = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: 'PATCH', headers: SB.headers, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(table, match) {
    const query = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      method: 'DELETE', headers: SB.headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async upsert(table, body, onConflict = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...SB.headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

/* ════════════════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
════════════════════════════════════════════════════════════ */
function lsGet(key, def = null) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('localStorage full'); } }

/* ════════════════════════════════════════════════════════════
   DATA NORMALISATION  (Supabase row → app object)
════════════════════════════════════════════════════════════ */
function normalisePost(row) {
  return {
    id:          row.id,
    title:       row.title,
    content:     row.content,
    category:    row.category || 'General',
    tags:        row.tags || [],
    image:       row.image || null,
    authorName:  row.author_name || 'Anonymous',
    authorId:    row.author_id || null,
    reactions:   row.reaction_counts || {},
    myReactions: {},
    comments:    [],
    iso:         row.created_at,
    date:        new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}
function normaliseUser(row) {
  return { id: row.id, name: row.name, username: row.username, email: row.email, via: row.via || 'email', bio: row.bio || '', website: row.website || '', profilePic: row.profile_pic || null, password: row.password || '', joined: row.joined_at };
}
function normaliseComment(row) {
  return { id: row.id, postId: row.post_id, parentId: row.parent_id || null, author: row.author_name, username: row.author_username || '', email: row.author_email, via: row.author_via || 'email', text: row.text, likes: row.likes || 0, likedBy: row.liked_by || [], replies: [], iso: row.created_at };
}

/* ════════════════════════════════════════════════════════════
   DB PUBLIC API
════════════════════════════════════════════════════════════ */
const DB = {

  isReady: DB_READY,

  /* ── POSTS ─────────────────────────────────────────── */
  async getPosts() {
    if (!DB_READY) return lsGet('kirengaBlogPosts', []);
    try {
      const rows = await SB.get('posts_with_reactions', 'order=created_at.desc&limit=200');
      return rows.map(normalisePost);
    } catch (e) { console.warn('DB getPosts failed, using localStorage', e.message); return lsGet('kirengaBlogPosts', []); }
  },

  async createPost(post) {
    const row = { title: post.title, content: post.content, category: post.category, tags: post.tags || [], image: post.image || null, author_name: post.authorName || 'Anonymous', author_id: post.authorId || null };
    if (!DB_READY) {
      const posts = lsGet('kirengaBlogPosts', []);
      const np = { ...post, id: Date.now().toString(36) + Math.random().toString(36).slice(2), iso: new Date().toISOString(), date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), reactions: {}, myReactions: {}, comments: [] };
      posts.unshift(np); lsSet('kirengaBlogPosts', posts); return np;
    }
    try {
      const [created] = await SB.post('posts', row);
      return normalisePost(created);
    } catch (e) {
      console.warn('DB createPost failed', e.message);
      const posts = lsGet('kirengaBlogPosts', []);
      const np = { ...post, id: Date.now().toString(36), iso: new Date().toISOString(), date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), reactions: {}, myReactions: {}, comments: [] };
      posts.unshift(np); lsSet('kirengaBlogPosts', posts); return np;
    }
  },

  async deletePost(id) {
    if (!DB_READY) { lsSet('kirengaBlogPosts', lsGet('kirengaBlogPosts', []).filter(p => p.id !== id)); return true; }
    try { await SB.delete('posts', { id }); return true; }
    catch (e) { console.warn('DB deletePost failed', e.message); return false; }
  },

  /* ── USERS ─────────────────────────────────────────── */
  async createUser(data) {
    const row = { name: data.name, username: data.username, email: data.email, password: data.password || '', via: data.via || 'email' };
    if (!DB_READY) {
      const users = lsGet('kirengaUsers', []);
      const nu = { ...row, id: Date.now().toString(36), joined_at: new Date().toISOString() };
      users.push(nu); lsSet('kirengaUsers', users); return normaliseUser(nu);
    }
    try {
      const [created] = await SB.post('users', row);
      return normaliseUser(created);
    } catch (e) {
      try { const existing = await SB.get('users', `email=eq.${encodeURIComponent(data.email)}&limit=1`); if (existing.length) return normaliseUser(existing[0]); } catch {}
      console.warn('DB createUser failed', e.message); return null;
    }
  },

  async getUserByEmail(email) {
    if (!DB_READY) return lsGet('kirengaUsers', []).find(u => u.email === email) || null;
    try {
      const rows = await SB.get('users', `email=eq.${encodeURIComponent(email)}&limit=1`);
      return rows.length ? normaliseUser(rows[0]) : null;
    } catch (e) {
      console.warn('DB getUserByEmail failed', e.message);
      return lsGet('kirengaUsers', []).find(u => u.email === email) || null;
    }
  },

  async updateUser(id, data) {
    const row = {}; if (data.name) row.name = data.name; if (data.username) row.username = data.username; if (data.bio) row.bio = data.bio; if (data.website) row.website = data.website; if (data.profilePic) row.profile_pic = data.profilePic; row.updated_at = new Date().toISOString();
    if (!DB_READY) {
      const users = lsGet('kirengaUsers', []); const i = users.findIndex(u => u.id === id || u.email === data.email);
      if (i > -1) { users[i] = { ...users[i], ...data }; lsSet('kirengaUsers', users); } return true;
    }
    try { await SB.patch('users', { id }, row); return true; }
    catch (e) { console.warn('DB updateUser failed', e.message); return false; }
  },

  /* ── REACTIONS ─────────────────────────────────────── */
  async setReaction(postId, userEmail, userId, emojiKey) {
    if (!DB_READY) return true;
    try { await SB.delete('reactions', { post_id: postId, user_email: userEmail }); } catch {}
    if (!emojiKey) return true;
    try { await SB.post('reactions', { post_id: postId, user_id: userId || null, user_email: userEmail, emoji_key: emojiKey }); return true; }
    catch (e) { console.warn('DB setReaction failed', e.message); return false; }
  },

  /* ── COMMENTS ──────────────────────────────────────── */
  async getComments(postId) {
    if (!DB_READY) return lsGet('kirengaBlogPosts', []).find(p => p.id === postId)?.comments || [];
    try {
      const rows = await SB.get('comments', `post_id=eq.${postId}&order=created_at.asc`);
      const all = rows.map(normaliseComment);
      const topLevel = all.filter(c => !c.parentId); const replies = all.filter(c => c.parentId);
      topLevel.forEach(c => { c.replies = replies.filter(r => r.parentId === c.id); });
      return topLevel.reverse();
    } catch (e) { console.warn('DB getComments failed', e.message); return []; }
  },

  async addComment(postId, parentId, author, text) {
    const row = { post_id: postId, parent_id: parentId || null, author_name: author.name, author_email: author.email, author_via: author.via || 'email', author_id: author.id || null, text };
    if (!DB_READY) {
      const posts = lsGet('kirengaBlogPosts', []); const idx = posts.findIndex(p => p.id === postId); if (idx === -1) return null;
      const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), postId, parentId: parentId || null, author: author.name, username: author.username || '', email: author.email, via: author.via || 'email', profilePic: author.profilePic || null, text, likes: 0, likedBy: [], replies: [], iso: new Date().toISOString() };
      posts[idx].comments = posts[idx].comments || [];
      if (parentId) { const fn = (arr) => { for (const x of arr) { if (x.id === parentId) { x.replies = x.replies || []; x.replies.push(c); return true; } if (x.replies && fn(x.replies)) return true; } }; fn(posts[idx].comments); }
      else { posts[idx].comments.unshift(c); }
      lsSet('kirengaBlogPosts', posts); return c;
    }
    try { const [created] = await SB.post('comments', row); return normaliseComment(created); }
    catch (e) { console.warn('DB addComment failed', e.message); return null; }
  },

  async likeComment(commentId, userEmail, currently_liked) {
    if (!DB_READY) {
      const posts = lsGet('kirengaBlogPosts', []);
      const fn = (arr) => { for (const c of arr) { if (c.id === commentId) { c.likedBy = c.likedBy || []; const i = c.likedBy.indexOf(userEmail); if (currently_liked) { if (i > -1) { c.likedBy.splice(i, 1); c.likes = Math.max(0, c.likes - 1); } } else { if (i === -1) { c.likedBy.push(userEmail); c.likes = (c.likes || 0) + 1; } } return true; } if (c.replies && fn(c.replies)) return true; } };
      posts.forEach(p => { if (p.comments) fn(p.comments); }); lsSet('kirengaBlogPosts', posts); return true;
    }
    try {
      const rows = await SB.get('comments', `id=eq.${commentId}&limit=1`); if (!rows.length) return false;
      let likedBy = rows[0].liked_by || [];
      if (currently_liked) likedBy = likedBy.filter(e => e !== userEmail);
      else if (!likedBy.includes(userEmail)) likedBy.push(userEmail);
      await SB.patch('comments', { id: commentId }, { likes: likedBy.length, liked_by: likedBy }); return true;
    } catch (e) { console.warn('DB likeComment failed', e.message); return false; }
  },

  /* ── NEWSLETTER ────────────────────────────────────── */
  async subscribe(email) {
    if (!DB_READY) { const s = lsGet('kirengaSubs', []); if (s.includes(email)) return 'already'; s.push(email); lsSet('kirengaSubs', s); return 'ok'; }
    try { await SB.post('newsletter', { email }); return 'ok'; }
    catch (e) { if (e.message.includes('unique') || e.message.includes('duplicate')) return 'already'; console.warn('DB subscribe failed', e.message); return 'error'; }
  },

  /* ── CONTACT ───────────────────────────────────────── */
  async sendContact(data) {
    const row = { name: data.name, email: data.email, subject: data.subject || '', message: data.message };
    if (!DB_READY) { const m = lsGet('kirengaMessages', []); m.unshift({ ...row, date: new Date().toLocaleString() }); lsSet('kirengaMessages', m); return true; }
    try { await SB.post('contact_messages', row); return true; }
    catch (e) { console.warn('DB sendContact failed', e.message); const m = lsGet('kirengaMessages', []); m.unshift({ ...row, date: new Date().toLocaleString() }); lsSet('kirengaMessages', m); return true; }
  },

  /* ── FEEDBACK ──────────────────────────────────────── */
  async sendFeedback(data) {
    const row = { type: data.type, rating: data.rating, text: data.text, email: data.email || null };
    if (!DB_READY) { const f = lsGet('kirengaFeedbacks', []); f.unshift({ ...row, date: new Date().toLocaleString() }); lsSet('kirengaFeedbacks', f); return true; }
    try { await SB.post('feedback', row); return true; }
    catch (e) { console.warn('DB sendFeedback failed', e.message); const f = lsGet('kirengaFeedbacks', []); f.unshift({ ...row, date: new Date().toLocaleString() }); lsSet('kirengaFeedbacks', f); return true; }
  },

  /* ── MEDIA ─────────────────────────────────────────── */
  async saveMedia(userId, file) {
    if (!DB_READY) return true;
    try { await SB.post('media', { user_id: userId || null, name: file.name, type: file.type, size: file.size, data: file.type.startsWith('image/') ? file.data : null }); return true; }
    catch (e) { console.warn('DB saveMedia failed', e.message); return false; }
  },

  /* ── REALTIME ──────────────────────────────────────── */
  subscribeToPostChanges(onInsert, onDelete) {
    if (!DB_READY) return null;
    const wsUrl = SUPABASE_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPABASE_ANON_KEY + '&vsn=1.0.0';
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({ topic: 'realtime:public:posts', event: 'phx_join', payload: { config: { broadcast: { self: false }, postgres_changes: [{ event: '*', schema: 'public', table: 'posts' }] } }, ref: '1' }));
        console.log('🔴 Supabase Realtime connected — posts update live!');
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.event === 'postgres_changes') {
            const change = data.payload?.data;
            if (change?.type === 'INSERT' && onInsert) onInsert(normalisePost(change.record));
            if (change?.type === 'DELETE' && onDelete) onDelete(change.old_record?.id);
          }
        } catch {}
      };
      ws.onerror = e => console.warn('Realtime WS error', e);
      return ws;
    } catch (e) { console.warn('Realtime not available', e); return null; }
  },
};

/* ════════════════════════════════════════════════════════════
   MIGRATION: copies existing localStorage data → Supabase
   Runs once automatically when credentials are first added.
════════════════════════════════════════════════════════════ */
async function migrateLocalStorageToSupabase() {
  if (!DB_READY || localStorage.getItem('kirengaMigrated')) return;
  const localPosts = lsGet('kirengaBlogPosts', []);
  const localUsers = lsGet('kirengaUsers', []);
  let migrated = 0;
  console.group('🔄 Migrating localStorage → Supabase');
  for (const user of localUsers) {
    try {
      await SB.upsert('users', { name: user.name, username: user.username || user.email.split('@')[0], email: user.email, password: user.password || '', via: user.via || 'email', bio: user.bio || '', website: user.website || '' }, 'email');
      migrated++;
    } catch (e) { console.warn('Could not migrate user:', user.email); }
  }
  for (const post of localPosts) {
    try {
      await SB.upsert('posts', { title: post.title, content: post.content, category: post.category || 'General', tags: post.tags || [], image: post.image || null, author_name: post.authorName || 'Kirenga Isaac', created_at: post.iso || new Date().toISOString() }, 'title');
      migrated++;
    } catch (e) { console.warn('Could not migrate post:', post.title); }
  }
  localStorage.setItem('kirengaMigrated', '1');
  console.log(`✅ Migration complete — ${migrated} records moved to Supabase`);
  console.groupEnd();
}

/* ════════════════════════════════════════════════════════════
   INIT — called from app.js DOMContentLoaded
════════════════════════════════════════════════════════════ */
async function initDB() {
  showDbStatus();
  if (DB_READY) {
    console.log('%c✅ Supabase DB connected', 'color:#34a853;font-weight:700');
    await migrateLocalStorageToSupabase();
  } else {
    console.log('%c🟡 localStorage mode — add Supabase keys to db.js to enable cloud DB', 'color:#f9ab00;font-weight:700');
  }
}
