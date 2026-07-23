import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from '../config.js';
import { recognizeFridgeImage, generateRecipes } from './openrouter.js';
import { getSupabaseAnon, supabaseForToken, extractBearerToken } from './supabase.js';

let envError = null;
try {
  validateEnv();
} catch (err) {
  envError = err;
  console.error(err.message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, per PRD 01 FR-1

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('jpg 또는 png 이미지만 업로드할 수 있습니다.'));
    }
    cb(null, true);
  },
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', (req, res, next) => {
  if (envError) {
    return res.status(500).json({ error: `서버 설정 오류: ${envError.message}` });
  }
  next();
});

async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const client = supabaseForToken(token);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    return res.status(401).json({ error: '세션이 유효하지 않습니다. 다시 로그인해주세요.' });
  }

  req.user = data.user;
  req.db = client;
  next();
}

async function getOptionalUser(req) {
  const token = extractBearerToken(req);
  if (!token) return null;

  const client = supabaseForToken(token);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return { user: data.user, client };
}

async function getOrCreateProfile(client, user) {
  const { data: existing, error: selectErr } = await client
    .from('users')
    .select('id, email, allergies, dislikes, diet_type, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (selectErr) throw selectErr;
  if (existing) return existing;

  const { data: created, error: insertErr } = await client
    .from('users')
    .insert({ id: user.id, email: user.email })
    .select('id, email, allergies, dislikes, diet_type, created_at')
    .single();

  if (insertErr) throw insertErr;
  return created;
}

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email과 password가 필요합니다.' });
  }

  const { data, error } = await getSupabaseAnon().auth.signUp({ email, password });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ user: data.user, session: data.session });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email과 password가 필요합니다.' });
  }

  const { data, error } = await getSupabaseAnon().auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ error: error.message });
  }

  res.json({ user: data.user, session: data.session });
});

app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.db, req.user);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: `프로필 조회에 실패했습니다: ${err.message}` });
  }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { allergies, dislikes, diet_type: dietType } = req.body || {};

  try {
    await getOrCreateProfile(req.db, req.user);

    const { data, error } = await req.db
      .from('users')
      .update({
        allergies: Array.isArray(allergies) ? allergies : [],
        dislikes: Array.isArray(dislikes) ? dislikes : [],
        diet_type: dietType || null,
      })
      .eq('id', req.user.id)
      .select('id, email, allergies, dislikes, diet_type, created_at')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `프로필 수정에 실패했습니다: ${err.message}` });
  }
});

app.post('/api/recipes/save', requireAuth, async (req, res) => {
  const { title, have, need, steps, est_time_min: estTimeMin, difficulty, source_items: sourceItems } =
    req.body || {};

  if (!title || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'title과 steps(최소 1개)가 필요합니다.' });
  }

  try {
    const { data, error } = await req.db
      .from('recipes_tbl')
      .insert({
        user_id: req.user.id,
        title,
        have: have || [],
        need: need || [],
        steps,
        est_time_min: estTimeMin ?? null,
        difficulty: difficulty ?? null,
        source_items: sourceItems ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `레시피 저장에 실패했습니다: ${err.message}` });
  }
});

app.get('/api/recipes/saved', requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('recipes_tbl')
      .select()
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ recipes: data });
  } catch (err) {
    res.status(500).json({ error: `저장된 레시피 조회에 실패했습니다: ${err.message}` });
  }
});

app.delete('/api/recipes/saved/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.db
      .from('recipes_tbl')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: '해당 레시피를 찾을 수 없습니다.' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: `레시피 삭제에 실패했습니다: ${err.message}` });
  }
});

app.post('/api/inventory/recognize', (req, res) => {
  upload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'image 필드로 파일을 업로드해주세요.' });
    }

    const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    try {
      const result = await recognizeFridgeImage(imageDataUrl);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `이미지 인식에 실패했습니다: ${err.message}` });
    }
  });
});

app.post('/api/recipes/generate', async (req, res) => {
  const { items, preferences } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items 배열(최소 1개)이 필요합니다.' });
  }

  let effectivePreferences = preferences;
  const auth = await getOptionalUser(req);
  if (auth) {
    try {
      const profile = await getOrCreateProfile(auth.client, auth.user);
      effectivePreferences = {
        allergies: preferences?.allergies ?? profile.allergies,
        dislikes: preferences?.dislikes ?? profile.dislikes,
        diet_type: preferences?.diet_type ?? profile.diet_type,
      };
    } catch (err) {
      console.error(`프로필 조회 실패, 요청 preferences로 계속 진행: ${err.message}`);
    }
  }

  try {
    const result = await generateRecipes(items, effectivePreferences);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `레시피 생성에 실패했습니다: ${err.message}` });
  }
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
